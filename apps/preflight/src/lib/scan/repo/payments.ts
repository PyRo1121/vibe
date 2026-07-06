import { normalizeRepoFinding } from '$lib/scan/repo/findings';
import type {
	PackageManifestEvidence,
	RepoFileEvidence,
	RepoReadinessFinding
} from '$lib/scan/repo/readiness';
import type { ScanCheck } from '$lib/scan/types';

const STRIPE_PROVIDER_DEPENDENCIES = ['stripe', '@stripe/stripe-js', '@stripe/react-stripe-js'];

const PADDLE_PROVIDER_DEPENDENCIES = [
	'@paddle/paddle-js',
	'@paddle/paddle-node-sdk',
	'@paddle/paddle-node-sdk-core',
	'paddle-node-sdk',
	'paddle-sdk',
	'paddle-js'
];

const LEMON_PROVIDER_DEPENDENCIES = ['@lemonsqueezy/lemonsqueezy.js', 'lemonsqueezy.ts'];

const PAYMENT_PROVIDER_DEPENDENCIES = [
	...STRIPE_PROVIDER_DEPENDENCIES,
	...PADDLE_PROVIDER_DEPENDENCIES,
	...LEMON_PROVIDER_DEPENDENCIES
];

const PAYMENT_TEXT_PATTERN =
	/(?:\b(?:stripe\.checkout|checkout\.sessions\.create|paymentIntents\.create|stripe\.webhooks|billingPortal\.sessions\.create|PaymentIntent|price_[A-Za-z0-9]+|loadStripe|redirectToCheckout|pk_(?:test|live)_[A-Za-z0-9_]+|Paddle|initializePaddle|paddle|paddle-signature|transaction\.completed|transaction\.past_due|transaction\.payment_failed|subscription\.activated|subscription\.created|subscription\.updated|subscription\.canceled|subscription\.cancelled|lemon\s*squeezy|lemonsqueezy|LemonSqueezy|x-signature|order_created|subscription_created|subscription_updated|subscription_payment_success|subscription_payment_failed|subscription_cancelled|variant_[A-Za-z0-9]+)\b|\bStripe\()/i;
const PAYMENT_PATH_PATTERN =
	/(^|\/)(stripe|payment|payments|billing|checkout|subscription|subscriptions|paddle|lemon|lemonsqueezy)(\/|\.|-|$)/i;
const LIVE_PAYMENT_SECRET_PATTERN = /\b(?:sk_live|rk_live)_[A-Za-z0-9_]{20,}\b/;

function finding(
	id: string,
	title: string,
	status: ScanCheck['status'],
	message: string,
	evidence?: RepoReadinessFinding['evidence'],
	launchImpact?: RepoReadinessFinding['launchImpact']
): RepoReadinessFinding {
	return normalizeRepoFinding({
		id,
		category: 'payments',
		title,
		status,
		message,
		evidence,
		launchImpact
	});
}

function dependencies(manifest: PackageManifestEvidence | undefined): Record<string, string> {
	return Object.assign(
		{},
		manifest?.json.dependencies,
		manifest?.json.devDependencies,
		manifest?.json.optionalDependencies,
		manifest?.json.peerDependencies
	);
}

function hasDependency(manifest: PackageManifestEvidence | undefined, names: string[]): boolean {
	const all = dependencies(manifest);
	return names.some((name) => all[name] != null);
}

function manifestsHaveDependency(manifests: PackageManifestEvidence[], names: string[]): boolean {
	return manifests.some((manifest) => hasDependency(manifest, names));
}

function combinedFileText(files: RepoFileEvidence[]): string {
	return files
		.map((file) => file.text ?? '')
		.filter(Boolean)
		.join('\n');
}

function hasStripeSignal(manifests: PackageManifestEvidence[], files: RepoFileEvidence[]): boolean {
	const text = combinedFileText(files);
	return (
		manifestsHaveDependency(manifests, STRIPE_PROVIDER_DEPENDENCIES) ||
		/\b(?:stripe|Stripe|checkout\.sessions\.create|paymentIntents\.create|stripe-signature|checkout\.session|invoice\.paid|customer\.subscription)\b/i.test(
			text
		)
	);
}

function paymentFileText(files: RepoFileEvidence[]): string {
	return paymentFiles(files)
		.map((file) => file.text ?? '')
		.filter(Boolean)
		.join('\n');
}

function paymentProviderDetected(
	manifests: PackageManifestEvidence[],
	files: RepoFileEvidence[]
): boolean {
	if (manifestsHaveDependency(manifests, PAYMENT_PROVIDER_DEPENDENCIES)) return true;
	return PAYMENT_TEXT_PATTERN.test(combinedFileText(files));
}

function paymentFiles(files: RepoFileEvidence[]): RepoFileEvidence[] {
	const matches = files.filter((file) => {
		const text = file.text ?? '';
		return (
			PAYMENT_PATH_PATTERN.test(file.path) ||
			PAYMENT_TEXT_PATTERN.test(text) ||
			LIVE_PAYMENT_SECRET_PATTERN.test(text)
		);
	});
	return matches.length > 0 ? matches : files;
}

function firstPaymentFile(
	files: RepoFileEvidence[],
	pattern: RegExp
): RepoFileEvidence | undefined {
	return paymentFiles(files).find(
		(file) => pattern.test(file.text ?? '') || pattern.test(file.path)
	);
}

function hasServerOwnedCheckout(files: RepoFileEvidence[]): boolean {
	return /\b(checkout\.sessions\.create|paymentIntents\.create|checkouts\.create|createCheckout|paddle\.transactions\.create)\b|\/v1\/checkouts\b/i.test(
		combinedFileText(files)
	);
}

function hasClientOnlyStripeCheckout(files: RepoFileEvidence[]): boolean {
	const text = paymentFileText(files);
	const hasServerPaymentSignal =
		/(?:\b(?:PaymentIntent|stripe\.webhooks|constructEvent|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET)\b|\bStripe\()/i.test(
			text
		);
	return (
		/\b(loadStripe|redirectToCheckout)\b|@stripe\/stripe-js|\bpk_(?:test|live)_[A-Za-z0-9_]+/i.test(
			text
		) &&
		!hasServerOwnedCheckout(files) &&
		!hasServerPaymentSignal
	);
}

function webhookSignal(files: RepoFileEvidence[]): RepoFileEvidence | undefined {
	return files.find((file) => {
		const text = file.text ?? '';
		return (
			/webhook/i.test(file.path) ||
			/\b(checkout\.session\.completed|checkout\.session\.async_payment_succeeded|checkout\.session\.async_payment_failed|customer\.subscription|invoice\.paid|invoice\.payment_failed|stripe-signature|stripe\.webhooks|paddle-signature|transaction\.(?:completed|past_due|payment_failed)|subscription\.(?:activated|created|canceled|cancelled|past_due|paused|updated)|x-signature|order_created|subscription_created|subscription_updated|subscription_payment_(?:success|failed)|subscription_(?:cancelled|canceled|expired)|webhook)\b/i.test(
				text
			)
		);
	});
}

function hasWebhookSignatureVerification(files: RepoFileEvidence[]): boolean {
	const text = combinedFileText(files);
	const verifiesStripe = /stripe\.webhooks\.constructEvent(?:Async)?\b|constructEventAsync\b/i.test(
		text
	);
	const verifiesPaddle =
		/\b(?:paddle\.)?webhooks\.unmarshal\b/i.test(text) ||
		(/paddle-signature/i.test(text) &&
			/\b(PADDLE_WEBHOOK_SECRET|webhookSecret|WEBHOOK_SECRET)\b/i.test(text) &&
			/\b(createHmac|timingSafeEqual|verifyWebhook|validateWebhook|verifySignature)\b/i.test(text));
	const verifiesLemonSqueezy =
		/x-signature/i.test(text) &&
		/\b(LEMONSQUEEZY_WEBHOOK_SECRET|LEMON_SQUEEZY_WEBHOOK_SECRET|webhookSecret|WEBHOOK_SECRET)\b/i.test(
			text
		) &&
		/\bcreateHmac\b/i.test(text) &&
		/\btimingSafeEqual\b/i.test(text);

	return verifiesStripe || verifiesPaddle || verifiesLemonSqueezy;
}

function webhookCoverageGaps(
	manifests: PackageManifestEvidence[],
	files: RepoFileEvidence[]
): string[] {
	const text = combinedFileText(files);
	const requiresStripeAsync = hasStripeSignal(manifests, files);
	const coverage: Array<{ label: string; pattern: RegExp; required?: boolean }> = [
		{
			label: 'checkout success',
			pattern:
				/\b(checkout\.session\.completed|invoice\.paid|transaction\.completed|subscription\.(?:activated|created)|order_created|subscription_created|subscription_payment_success)\b/i
		},
		{
			label: 'async checkout success',
			pattern: /\bcheckout\.session\.async_payment_succeeded\b/i,
			required: requiresStripeAsync
		},
		{
			label: 'failed payment',
			pattern:
				/\b(checkout\.session\.async_payment_failed|invoice\.payment_failed|transaction\.(?:past_due|payment_failed)|subscription\.past_due|subscription_payment_failed)\b/i
		},
		{
			label: 'subscription cancellation',
			pattern:
				/\b(customer\.subscription\.deleted|subscription\.(?:canceled|cancelled|updated)|subscription_(?:updated|cancelled|canceled|expired))\b/i
		}
	];

	return coverage
		.filter(({ pattern, required = true }) => required && !pattern.test(text))
		.map(({ label }) => label);
}

function hasSubscriptionLifecycleSignal(
	manifests: PackageManifestEvidence[],
	files: RepoFileEvidence[]
): boolean {
	const text = combinedFileText(files);
	return (
		/\b(mode\s*:\s*['"]subscription['"]|customer\.subscription|subscription\.|subscription_|billingPortal\.sessions\.create|subscriptions?)\b/i.test(
			text
		) || files.some((file) => /(^|\/)subscriptions?(\/|\.|-|$)/i.test(file.path))
	);
}

function hasEntitlementGrantSignal(files: RepoFileEvidence[]): boolean {
	const text = combinedFileText(files);
	return (
		/\b(grantAccess|grantEntitlement|entitlement|entitlements|markPaid|unlock|fulfill|fulfilled|fulfillment|provision|provisioned|activateSubscription)\b/i.test(
			text
		) ||
		/\bsubscription\b[\s\S]{0,120}\b(active|paid)\b/i.test(text) ||
		/\b(active|paid)\b[\s\S]{0,120}\bsubscription\b/i.test(text)
	);
}

function hasEntitlementRevocationSignal(files: RepoFileEvidence[]): boolean {
	const text = combinedFileText(files);
	return (
		/\b(revokeAccess|revokeEntitlement|removeAccess|disableAccess|suspendAccess|expireAccess|deprovision|deprovisioned|markCanceled|markCancelled|cancelSubscription)\b/i.test(
			text
		) ||
		/\b(?:access|entitlement|subscription)\b[\s\S]{0,120}\b(?:revoked|inactive|unpaid|past_due|expired|canceled|cancelled|disabled|suspended)\b/i.test(
			text
		) ||
		/\b(?:revoked|inactive|unpaid|past_due|expired|canceled|cancelled|disabled|suspended)\b[\s\S]{0,120}\b(?:access|entitlement|subscription)\b/i.test(
			text
		)
	);
}

function hasEntitlementFulfillmentSignal(
	manifests: PackageManifestEvidence[],
	files: RepoFileEvidence[]
): boolean {
	const hasGrant = hasEntitlementGrantSignal(files);
	if (!hasSubscriptionLifecycleSignal(manifests, files))
		return hasGrant || hasEntitlementRevocationSignal(files);
	return hasGrant && hasEntitlementRevocationSignal(files);
}

function billingPortalFile(files: RepoFileEvidence[]): RepoFileEvidence | undefined {
	return paymentFiles(files).find((file) =>
		/\b(billingPortal\.sessions\.create|billing_portal|customer portal|customerPortal|manage subscription|manage billing|portal\.sessions\.create)\b/i.test(
			file.text ?? ''
		)
	);
}

function livePaymentSecretFile(files: RepoFileEvidence[]): RepoFileEvidence | undefined {
	return paymentFiles(files).find((file) => LIVE_PAYMENT_SECRET_PATTERN.test(file.text ?? ''));
}

function usesSecretFromEnvironment(files: RepoFileEvidence[]): boolean {
	return /\b(env|process\.env|import\.meta\.env)\.[A-Z0-9_]*(STRIPE|PADDLE|LEMON)[A-Z0-9_]*(SECRET|KEY|TOKEN)|\b(STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|PADDLE_API_KEY|LEMONSQUEEZY_API_KEY)\b/i.test(
		combinedFileText(files)
	);
}

function hasSubscriptionCheckoutMode(files: RepoFileEvidence[]): boolean {
	return /\bmode\s*:\s*['"]subscription['"]/i.test(combinedFileText(files));
}

function hasStripeCheckoutSessionCreation(files: RepoFileEvidence[]): boolean {
	return /\bcheckout\.sessions\.create\b/i.test(combinedFileText(files));
}

function hasWebhookIdempotencySignal(files: RepoFileEvidence[]): boolean {
	const text = combinedFileText(files);
	return (
		/\b(idempotent|idempotency|dedupe|dedup|alreadyProcessed|processedEvents?|webhookEvents?|eventLog|eventIds?)\b/i.test(
			text
		) ||
		/\bevent\.id\b[\s\S]{0,240}\b(findUnique|findFirst|upsert|create|insert|onConflict|onDuplicate|INSERT\s+OR\s+IGNORE|ON\s+CONFLICT)\b/i.test(
			text
		) ||
		/\b(findUnique|findFirst|upsert|create|insert|onConflict|onDuplicate|INSERT\s+OR\s+IGNORE|ON\s+CONFLICT)\b[\s\S]{0,240}\bevent\.id\b/i.test(
			text
		)
	);
}

export function analyzeBillingReadiness(
	manifests: PackageManifestEvidence[],
	files: RepoFileEvidence[]
): RepoReadinessFinding[] {
	if (!paymentProviderDetected(manifests, files)) return [];

	const webhook = webhookSignal(files);
	const verifiesWebhook = hasWebhookSignatureVerification(files);
	const webhookGaps = webhookCoverageGaps(manifests, files);
	const portal = billingPortalFile(files);
	const secretFile = livePaymentSecretFile(files);
	const envSecret = usesSecretFromEnvironment(files);
	const serverOwnedCheckout = hasServerOwnedCheckout(files);
	const clientOnlyCheckout = hasClientOnlyStripeCheckout(files);
	const entitlementFulfillment = hasEntitlementFulfillmentSignal(manifests, files);
	const stripeCheckoutSession = hasStripeCheckoutSessionCreation(files);
	const subscriptionCheckoutMode = hasSubscriptionCheckoutMode(files);
	const subscriptionLifecycle = hasSubscriptionLifecycleSignal(manifests, files);
	const webhookIdempotency = hasWebhookIdempotencySignal(files);

	return [
		finding(
			'checkout-server-owned',
			'Server-owned checkout',
			serverOwnedCheckout ? 'pass' : clientOnlyCheckout ? 'fail' : 'warn',
			serverOwnedCheckout
				? 'Checkout or payment creation is handled server-side.'
				: clientOnlyCheckout
					? 'Stripe checkout appears to be initialized only from client-side code; create checkout sessions on the server.'
					: 'Payment provider code was found, but no server-side checkout or payment creation was detected.',
			{
				path:
					firstPaymentFile(files, /\b(checkout\.sessions\.create|paymentIntents\.create)\b/i)
						?.path ??
					firstPaymentFile(
						files,
						/\b(loadStripe|redirectToCheckout)\b|@stripe\/stripe-js|\bpk_(?:test|live)_/i
					)?.path
			},
			serverOwnedCheckout ? undefined : clientOnlyCheckout ? 'blocker' : 'fix-soon'
		),
		...(stripeCheckoutSession && subscriptionLifecycle
			? [
					finding(
						'subscription-checkout-mode',
						'Subscription checkout mode',
						subscriptionCheckoutMode ? 'pass' : 'warn',
						subscriptionCheckoutMode
							? 'Stripe Checkout sessions are explicitly created in subscription mode.'
							: 'Stripe Checkout session creation was found alongside subscription lifecycle signals, but subscription mode was not explicit.',
						{
							path: firstPaymentFile(files, /\bcheckout\.sessions\.create\b/i)?.path
						},
						subscriptionCheckoutMode ? undefined : 'fix-soon'
					)
				]
			: []),
		finding(
			'webhook-signature-missing',
			'Webhook signature verification',
			webhook ? (verifiesWebhook ? 'pass' : 'fail') : 'warn',
			webhook
				? verifiesWebhook
					? 'Stripe-like webhook handling verifies incoming event signatures.'
					: 'Stripe-like webhook handling was found without signature verification; forged events could mark subscriptions paid or canceled.'
				: 'Payment provider code was found, but no Stripe-like webhook handler was detected for subscription lifecycle events.',
			{ path: webhook?.path },
			webhook && !verifiesWebhook ? 'blocker' : webhook ? undefined : 'fix-soon'
		),
		finding(
			'webhook-event-coverage',
			'Webhook event coverage',
			webhookGaps.length === 0 ? 'pass' : 'warn',
			webhookGaps.length === 0
				? 'Webhook handling covers successful checkout, async success, failed payment, and subscription cancellation events.'
				: `Webhook handling is missing payment lifecycle coverage for: ${webhookGaps.join(', ')}.`,
			{ path: webhook?.path },
			webhookGaps.length === 0 ? undefined : 'fix-soon'
		),
		finding(
			'webhook-idempotency',
			'Webhook idempotency',
			webhook && webhookIdempotency ? 'pass' : 'warn',
			webhook
				? webhookIdempotency
					? 'Webhook handling records or checks processed event ids before fulfillment.'
					: 'Webhook handling was found without an idempotency or processed-event signal; provider retries could double-grant or double-revoke access.'
				: 'Payment provider code was found, but no webhook handler was detected to make payment events idempotent.',
			{ path: webhook?.path },
			webhook && webhookIdempotency ? undefined : 'fix-soon'
		),
		finding(
			'entitlement-fulfillment',
			'Entitlement fulfillment',
			entitlementFulfillment ? 'pass' : 'warn',
			entitlementFulfillment
				? subscriptionLifecycle
					? 'Payment lifecycle handling includes both entitlement grant and subscription revocation signals.'
					: 'Payment lifecycle handling includes access grant, fulfillment, or entitlement updates.'
				: subscriptionLifecycle
					? 'Subscription lifecycle handling was found without clear access grant and revocation signals.'
					: 'Payment lifecycle handling was found without a clear access grant, fulfillment, or entitlement update.',
			{ path: webhook?.path },
			entitlementFulfillment ? undefined : 'fix-soon'
		),
		finding(
			'billing-portal',
			'Customer billing portal',
			portal ? 'pass' : 'warn',
			portal
				? 'Customer billing management or portal handling is present.'
				: 'Stripe-like subscription code was found, but no customer billing portal or billing-management route was detected.',
			{ path: portal?.path ?? files.find((file) => /billing/i.test(file.path))?.path },
			portal ? undefined : 'fix-soon'
		),
		finding(
			'payment-env-safety',
			'Payment secret handling',
			secretFile ? 'fail' : 'pass',
			secretFile
				? 'A live payment secret literal was found in payment code. Move payment secrets to environment bindings or secret storage.'
				: envSecret
					? 'Payment secrets appear to be read from environment bindings.'
					: 'No live payment secret literals were found in sampled payment files.',
			{ path: secretFile?.path },
			secretFile ? 'blocker' : undefined
		)
	];
}
