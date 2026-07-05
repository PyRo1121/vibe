import { normalizeRepoFinding } from '$lib/scan/repo/findings';
import type {
	PackageManifestEvidence,
	RepoFileEvidence,
	RepoReadinessFinding
} from '$lib/scan/repo/readiness';
import type { ScanCheck } from '$lib/scan/types';

const PAYMENT_PROVIDER_DEPENDENCIES = [
	'stripe',
	'@stripe/stripe-js',
	'@stripe/react-stripe-js',
	'@paddle/paddle-js',
	'paddle-js',
	'@lemonsqueezy/lemonsqueezy.js',
	'lemonsqueezy.ts'
];

const PAYMENT_TEXT_PATTERN =
	/(?:\b(?:stripe\.checkout|checkout\.sessions\.create|paymentIntents\.create|stripe\.webhooks|billingPortal\.sessions\.create|PaymentIntent|price_[A-Za-z0-9]+|loadStripe|redirectToCheckout|pk_(?:test|live)_[A-Za-z0-9_]+|Paddle|initializePaddle|paddle|lemon\s*squeezy|lemonsqueezy|LemonSqueezy|variant_[A-Za-z0-9]+)\b|\bStripe\()/i;
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
	return /\b(checkout\.sessions\.create|paymentIntents\.create)\b/i.test(combinedFileText(files));
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
			/\b(checkout\.session\.completed|checkout\.session\.async_payment_succeeded|checkout\.session\.async_payment_failed|customer\.subscription|invoice\.paid|invoice\.payment_failed|stripe-signature|stripe\.webhooks|webhook)\b/i.test(
				text
			)
		);
	});
}

function hasWebhookSignatureVerification(files: RepoFileEvidence[]): boolean {
	const text = combinedFileText(files);
	return /stripe\.webhooks\.constructEvent(?:Async)?\b|constructEventAsync\b/i.test(text);
}

function webhookCoverageGaps(files: RepoFileEvidence[]): string[] {
	const text = combinedFileText(files);
	const coverage = [
		{
			label: 'checkout success',
			pattern: /\b(checkout\.session\.completed|invoice\.paid)\b/i
		},
		{
			label: 'async checkout success',
			pattern: /\bcheckout\.session\.async_payment_succeeded\b/i
		},
		{
			label: 'failed payment',
			pattern: /\b(checkout\.session\.async_payment_failed|invoice\.payment_failed)\b/i
		},
		{
			label: 'subscription cancellation',
			pattern: /\bcustomer\.subscription\.deleted\b/i
		}
	];

	return coverage.filter(({ pattern }) => !pattern.test(text)).map(({ label }) => label);
}

function hasEntitlementFulfillmentSignal(files: RepoFileEvidence[]): boolean {
	const text = combinedFileText(files);
	return (
		/\b(grantAccess|revokeAccess|entitlement|entitlements|markPaid|unlock|fulfill|fulfilled|fulfillment|provision|provisioned|deprovision|deprovisioned)\b/i.test(
			text
		) ||
		/\bsubscription\b[\s\S]{0,120}\b(active|paid)\b/i.test(text) ||
		/\b(active|paid)\b[\s\S]{0,120}\bsubscription\b/i.test(text)
	);
}

function hasBillingPortalSignal(files: RepoFileEvidence[]): boolean {
	const text = combinedFileText(files);
	return (
		/\b(billingPortal\.sessions\.create|billing_portal|customer portal)\b/i.test(text) ||
		files.some((file) =>
			/(^|\/)(account\/billing|settings\/billing|billing)(\/|$)/i.test(file.path)
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

export function analyzeBillingReadiness(
	manifests: PackageManifestEvidence[],
	files: RepoFileEvidence[]
): RepoReadinessFinding[] {
	if (!paymentProviderDetected(manifests, files)) return [];

	const webhook = webhookSignal(files);
	const verifiesWebhook = hasWebhookSignatureVerification(files);
	const webhookGaps = webhookCoverageGaps(files);
	const hasPortal = hasBillingPortalSignal(files);
	const secretFile = livePaymentSecretFile(files);
	const envSecret = usesSecretFromEnvironment(files);
	const serverOwnedCheckout = hasServerOwnedCheckout(files);
	const clientOnlyCheckout = hasClientOnlyStripeCheckout(files);
	const entitlementFulfillment = hasEntitlementFulfillmentSignal(files);

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
			'entitlement-fulfillment',
			'Entitlement fulfillment',
			entitlementFulfillment ? 'pass' : 'warn',
			entitlementFulfillment
				? 'Payment lifecycle handling includes access grant, revoke, fulfillment, or entitlement updates.'
				: 'Payment lifecycle handling was found without a clear access grant, revoke, fulfillment, or entitlement update.',
			{ path: webhook?.path },
			entitlementFulfillment ? undefined : 'fix-soon'
		),
		finding(
			'billing-portal',
			'Customer billing portal',
			hasPortal ? 'pass' : 'warn',
			hasPortal
				? 'Customer billing management or portal handling is present.'
				: 'Stripe-like subscription code was found, but no customer billing portal or billing-management route was detected.',
			{ path: files.find((file) => /billing/i.test(file.path))?.path },
			hasPortal ? undefined : 'fix-soon'
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
