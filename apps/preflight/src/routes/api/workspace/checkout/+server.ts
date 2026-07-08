import { createWorkspaceCheckoutSession, isStripeLiveMode } from '$lib/billing/stripe';
import { logFunnelEvent } from '$lib/metrics/funnel';
import { resolveAlphaFreeUnlock } from '$lib/product/alpha';
import { resolveDeploylintPlan } from '$lib/product/plans';
import { buildLoginRedirect } from '$lib/server/auth-config';
import { requireStripePriceId, requireStripeSecretKey, resolveAppUrl } from '$lib/server/env';
import { loadOrCreateWorkspaceState } from '$lib/server/workspace-store';
import { error, redirect } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

function checkoutErrorMessage(err: unknown): string {
	const message = err instanceof Error ? err.message : String(err);
	return message.slice(0, 300);
}

export const POST: RequestHandler = async ({ locals, platform, request, url }) => {
	if (!locals.user) {
		redirect(303, buildLoginRedirect(url));
	}
	const user = locals.user;

	const env = platform?.env;
	if (!env?.AUTH_DB) error(503, 'Workspace storage is not configured');

	const form = await request.formData();
	const plan = resolveDeploylintPlan(form.get('plan'));
	const ownerName = user.name?.trim() || user.email;
	const workspace = await loadOrCreateWorkspaceState(env.AUTH_DB, {
		alphaFreeUnlock: resolveAlphaFreeUnlock(env),
		ownerLabel: `${ownerName}'s workspace`,
		ownerUserId: user.id
	});
	const project = workspace.projects[0];
	if (!project || project.deployUrl === 'https://your-app.com') {
		error(400, 'Create a real project before starting workspace billing');
	}

	const secretKey = requireStripeSecretKey(env);
	const appUrl = resolveAppUrl(env, url.origin);
	const priceId = requireStripePriceId(env, plan.id);

	let checkoutUrl: string;
	try {
		const session = await createWorkspaceCheckoutSession({
			appUrl,
			customerEmail: user.email,
			deployUrl: project.deployUrl,
			plan: plan.id,
			priceId,
			projectId: project.id,
			secretKey,
			workspaceId: workspace.id
		});
		checkoutUrl = session.url;
	} catch (err) {
		console.error('deploylint.workspace_checkout.failed', {
			plan: plan.id,
			priceEnv: plan.stripePriceEnv,
			stripeMode: isStripeLiveMode(secretKey) ? 'live' : 'test',
			message: checkoutErrorMessage(err)
		});
		error(502, 'Workspace checkout failed - try again in a moment');
	}

	logFunnelEvent('checkout_started', { plan: plan.id, mode: 'workspace' });
	redirect(303, checkoutUrl);
};
