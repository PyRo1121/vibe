import { createCustomerBillingPortalSession } from '$lib/billing/stripe';
import { logFunnelEvent } from '$lib/metrics/funnel';
import { buildLoginRedirect } from '$lib/server/auth-config';
import { requireStripeSecretKey, resolveAppUrl } from '$lib/server/env';
import { loadWorkspaceBillingCustomer } from '$lib/server/workspace-store';
import { error, redirect } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, platform, url }) => {
	if (!locals.user) {
		redirect(303, buildLoginRedirect(url));
	}

	const env = platform?.env;
	if (!env?.AUTH_DB) error(503, 'Workspace storage is not configured');

	const billingCustomer = await loadWorkspaceBillingCustomer(env.AUTH_DB, locals.user.id);
	if (!billingCustomer) error(400, 'No active workspace subscription was found');

	const secretKey = requireStripeSecretKey(env);
	const appUrl = resolveAppUrl(env, url.origin);

	let portalUrl: string;
	try {
		const portal = await createCustomerBillingPortalSession({
			appUrl,
			customerId: billingCustomer.customerId,
			secretKey
		});
		portalUrl = portal.url;
	} catch {
		error(502, 'Billing portal failed - try again in a moment');
	}

	logFunnelEvent('billing_portal_opened', { mode: 'workspace' });
	redirect(303, portalUrl);
};
