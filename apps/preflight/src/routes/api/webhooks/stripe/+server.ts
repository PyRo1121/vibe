import { canonicalScanUrl } from '$lib/billing/stripe';
import { saveUnlock, setUnlockStatusBySubscription } from '$lib/billing/unlock-store';
import {
	isCheckoutSessionFulfilled,
	MAX_WEBHOOK_BYTES,
	parseStripeWebhookEvent,
	verifyStripeWebhookSignature
} from '$lib/billing/webhook';
import { logFunnelEvent } from '$lib/metrics/funnel';
import {
	DEPLOYLINT_PLAN_LIST,
	isDeploylintPlanId,
	type DeploylintPlanId
} from '$lib/product/plans';
import { requireStripeWebhookSecretKey } from '$lib/server/env';
import {
	type WorkspaceSubscriptionStatus,
	updateWorkspaceSubscriptionStatus,
	upsertWorkspaceSubscription
} from '$lib/server/workspace-store';
import { json, error, text } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

const WEBHOOK_DEDUP_TTL_SECONDS = 60 * 60 * 24 * 7;

function stripeObjectId(value: string | { id?: string } | undefined): string | null {
	if (typeof value === 'string' && value.trim()) return value.trim();
	if (typeof value === 'object' && typeof value.id === 'string' && value.id.trim()) {
		return value.id.trim();
	}
	return null;
}

function eventSubscriptionId(event: ReturnType<typeof parseStripeWebhookEvent>): string | null {
	const object = event.data.object;
	if (event.type.startsWith('customer.subscription.')) return stripeObjectId(object.id);
	return stripeObjectId(object.subscription);
}

function workspaceSubscriptionStatus(
	value: string | undefined
): WorkspaceSubscriptionStatus | null {
	if (value === 'active' || value === 'trialing') return 'active';
	if (value === 'past_due' || value === 'unpaid' || value === 'incomplete' || value === 'paused') {
		return 'past_due';
	}
	if (value === 'canceled' || value === 'incomplete_expired') return 'canceled';
	return null;
}

function subscriptionPriceId(event: ReturnType<typeof parseStripeWebhookEvent>): string | null {
	return event.data.object.items?.data.find((item) => item.price?.id)?.price?.id ?? null;
}

function subscriptionPlanFromEvent(
	event: ReturnType<typeof parseStripeWebhookEvent>,
	env: Env | undefined
): DeploylintPlanId | null {
	const priceId = subscriptionPriceId(event);
	if (priceId) {
		for (const plan of DEPLOYLINT_PLAN_LIST) {
			const configuredPrice = env?.[plan.stripePriceEnv as keyof Env];
			if (typeof configuredPrice === 'string' && configuredPrice.trim() === priceId) {
				return plan.id;
			}
		}
	}

	const metadataPlan = event.data.object.metadata?.plan;
	return isDeploylintPlanId(metadataPlan) ? metadataPlan : null;
}

async function hasWebhookEvent(kv: KVNamespace, eventId: string): Promise<boolean> {
	const key = `webhook:event:${eventId}`;
	try {
		return Boolean(await kv.get(key));
	} catch {
		return error(503, 'Webhook processing temporarily unavailable');
	}
}

async function markWebhookEventProcessed(kv: KVNamespace, eventId: string): Promise<void> {
	const key = `webhook:event:${eventId}`;
	try {
		await kv.put(key, '1', { expirationTtl: WEBHOOK_DEDUP_TTL_SECONDS });
	} catch {
		return error(503, 'Webhook processing temporarily unavailable');
	}
}

async function updateWorkspaceSubscriptionStatusOrFail(
	env: Env | undefined,
	subscriptionId: string,
	status: WorkspaceSubscriptionStatus,
	plan?: DeploylintPlanId | null
): Promise<void> {
	const saved = await updateWorkspaceSubscriptionStatus(env?.AUTH_DB, subscriptionId, status, plan);
	if (!saved) error(503, 'Workspace subscription storage unavailable');
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const webhookSecret = requireStripeWebhookSecretKey(platform?.env);

	const payload = await request.text();
	if (payload.length > MAX_WEBHOOK_BYTES) {
		error(413, 'Webhook payload too large');
	}

	const signature = request.headers.get('stripe-signature');

	if (!verifyStripeWebhookSignature(payload, signature, webhookSecret)) {
		error(400, 'Invalid webhook signature');
	}

	let event;
	try {
		event = parseStripeWebhookEvent(payload);
	} catch {
		error(400, 'Invalid webhook payload');
	}

	const reports = platform?.env?.REPORTS;
	if (event.id && reports) {
		if (await hasWebhookEvent(reports, event.id)) {
			return json({ received: true, duplicate: true });
		}
	}

	if (isCheckoutSessionFulfilled(event)) {
		const session = event.data.object;
		const scanUrl = session.metadata?.scan_url?.trim();
		const workspaceId = session.metadata?.workspace_id?.trim();
		const sessionId = session.id;
		const customerId = stripeObjectId(session.customer);
		const subscriptionId = stripeObjectId(session.subscription);
		if (scanUrl && sessionId && reports) {
			await saveUnlock(reports, canonicalScanUrl(scanUrl), sessionId, {
				customerId: customerId ?? undefined,
				subscriptionId: subscriptionId ?? undefined,
				plan: session.metadata?.plan
			});
		}
		if (workspaceId) {
			if (!platform?.env?.AUTH_DB) error(503, 'Workspace subscription storage unavailable');
			const saved = await upsertWorkspaceSubscription(platform.env.AUTH_DB, {
				customerId,
				plan: session.metadata?.plan,
				projectId: session.metadata?.project_id,
				stripeSubscriptionId: subscriptionId,
				workspaceId
			});
			if (!saved) error(400, 'Invalid workspace checkout metadata');
		}
		if (event.id && reports) await markWebhookEventProcessed(reports, event.id);
		logFunnelEvent('checkout_paid', {});
		return json({ received: true, sessionId: sessionId ?? null });
	}

	const subscriptionId = eventSubscriptionId(event);
	if (subscriptionId) {
		if (
			event.type === 'invoice.payment_failed' ||
			event.type === 'checkout.session.async_payment_failed'
		) {
			if (reports) {
				await setUnlockStatusBySubscription(reports, subscriptionId, {
					active: false,
					status: 'past_due'
				});
			}
			await updateWorkspaceSubscriptionStatusOrFail(platform?.env, subscriptionId, 'past_due');
			logFunnelEvent('checkout_payment_failed', {});
		} else if (event.type === 'customer.subscription.deleted') {
			if (reports) {
				await setUnlockStatusBySubscription(reports, subscriptionId, {
					active: false,
					status: 'canceled'
				});
			}
			await updateWorkspaceSubscriptionStatusOrFail(platform?.env, subscriptionId, 'canceled');
			logFunnelEvent('checkout_subscription_canceled', {});
		} else if (event.type === 'invoice.paid') {
			if (reports) {
				await setUnlockStatusBySubscription(reports, subscriptionId, {
					active: true,
					status: 'active'
				});
			}
			await updateWorkspaceSubscriptionStatusOrFail(platform?.env, subscriptionId, 'active');
		} else if (event.type === 'customer.subscription.updated') {
			const status = workspaceSubscriptionStatus(event.data.object.status);
			if (status) {
				if (reports) {
					await setUnlockStatusBySubscription(reports, subscriptionId, {
						active: status === 'active',
						status
					});
				}
				await updateWorkspaceSubscriptionStatusOrFail(
					platform?.env,
					subscriptionId,
					status,
					subscriptionPlanFromEvent(event, platform?.env)
				);
			}
		}
	}

	if (event.id && reports) await markWebhookEventProcessed(reports, event.id);
	return json({ received: true, ignored: event.type });
};

/** Stripe sends GET to verify endpoint exists during setup. */
export const GET: RequestHandler = async () => text('ok');
