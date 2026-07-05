# Deploylint Payments Readiness Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first paid wedge: Deploylint judges whether an AI-built SaaS can safely take money before launch.

**Architecture:** Extend the existing Deploylint scan system instead of creating a second product path. URL scans keep detecting visible payment surfaces, while public GitHub repo scans add the deeper payment-readiness evidence that matters: server-owned checkout, signed webhooks, lifecycle events, entitlement fulfillment, and billing self-service.

**Tech Stack:** SvelteKit 2, Svelte 5, Vitest, Playwright, Cloudflare Workers, existing Deploylint shared scan types, current Stripe docs guidance for Checkout Sessions, webhook signatures, subscription lifecycle events, and customer portal.

---

## File Structure

- Create `apps/preflight/src/lib/scan/repo/payments.ts`
  - Owns repo-level payment-readiness analysis.
  - Keeps payment detection, event coverage, webhook signature, checkout, entitlement, and portal rules out of the already-large `readiness.ts`.
- Create `apps/preflight/src/lib/scan/repo/payments.test.ts`
  - Behavioral tests for every emitted payment check id.
- Modify `apps/preflight/src/lib/scan/repo/readiness.ts`
  - Remove the current inline billing analyzer.
  - Re-export `analyzeBillingReadiness` from `payments.ts` so existing imports keep working.
- Modify `apps/preflight/src/lib/scan/repo/scan.ts`
  - Load high-signal payment files from the repo tree so the analyzer sees checkout routes, webhook handlers, billing routes, and entitlement code.
- Modify `apps/preflight/src/lib/scan/catalog.ts`
  - Add catalog entries for the new emitted payment check ids.
- Modify `apps/preflight/src/lib/scan/prompts.ts`
  - Add fix prompts for the new payment check ids and sharpen the existing Stripe prompt.
- Modify `apps/preflight/src/lib/scan/p0-ids.ts`
  - Make forged-webhook and client-owned-checkout failures launch blockers.
- Modify `apps/preflight/src/lib/scan/verdict.ts`
  - Add important payment warnings to P1 when they are not P0.
- Modify `apps/preflight/src/routes/+page.svelte`
  - Reposition homepage copy from generic "90+ checks" to "can this app safely take payments?"
- Modify `apps/preflight/e2e/home.spec.ts`
  - Assert the first-viewport messaging includes the payment-readiness wedge.

## Docs References Used

- Stripe docs: webhook handlers should verify signatures with the raw request body and endpoint secret. Relevant lifecycle events include `checkout.session.completed`, delayed payment events, subscription creation/deletion, and payment failure events.
- Stripe docs: customer billing management should use the customer portal for subscription self-service.
- SvelteKit docs: server-only code belongs in server routes/load modules, and JSON API routes return through `+server.ts` handlers.

---

### Task 1: Extract Repo Payment Readiness Analyzer

**Files:**
- Create: `apps/preflight/src/lib/scan/repo/payments.ts`
- Modify: `apps/preflight/src/lib/scan/repo/readiness.ts`
- Test: `apps/preflight/src/lib/scan/repo/payments.test.ts`

- [ ] **Step 1: Write the failing payment analyzer tests**

Create `apps/preflight/src/lib/scan/repo/payments.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { analyzeBillingReadiness } from './payments';
import type { PackageManifestEvidence, RepoFileEvidence } from './readiness';

const stripeManifest: PackageManifestEvidence = {
	path: 'package.json',
	json: {
		dependencies: { stripe: '^20.0.0' }
	}
};

function byId(findings: ReturnType<typeof analyzeBillingReadiness>) {
	return Object.fromEntries(findings.map((finding) => [finding.id, finding]));
}

describe('analyzeBillingReadiness', () => {
	it('does not emit payment findings when no payment provider is present', () => {
		const findings = analyzeBillingReadiness(
			[{ path: 'package.json', json: { dependencies: { svelte: '^5.0.0' } } }],
			[{ path: 'src/routes/api/webhooks/github/+server.ts', text: 'export const POST = () => {};' }]
		);

		expect(findings).toEqual([]);
	});

	it('fails client-only Stripe integrations that lack server-owned checkout creation', () => {
		const findings = byId(
			analyzeBillingReadiness(
				[
					{
						path: 'package.json',
						json: { dependencies: { '@stripe/stripe-js': '^7.0.0' } }
					}
				],
				[
					{
						path: 'src/routes/+page.svelte',
						text: "import { loadStripe } from '@stripe/stripe-js'; await loadStripe('pk_live_123');"
					}
				]
			)
		);

		expect(findings['checkout-server-owned']).toMatchObject({
			status: 'fail',
			category: 'payments',
			launchImpact: 'blocker'
		});
	});

	it('passes server-owned Stripe checkout session creation', () => {
		const findings = byId(
			analyzeBillingReadiness([stripeManifest], [
				{
					path: 'src/routes/api/checkout/+server.ts',
					text: `
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
  success_url,
  cancel_url
});
`
				}
			])
		);

		expect(findings['checkout-server-owned']).toMatchObject({
			status: 'pass'
		});
	});

	it('fails Stripe webhook handlers without signature verification', () => {
		const findings = byId(
			analyzeBillingReadiness([stripeManifest], [
				{
					path: 'src/routes/api/webhooks/stripe/+server.ts',
					text: `
export async function POST({ request }) {
  const event = await request.json();
  if (event.type === 'checkout.session.completed') return new Response('ok');
}
`
				}
			])
		);

		expect(findings['webhook-signature-missing']).toMatchObject({
			status: 'fail',
			category: 'payments',
			launchImpact: 'blocker'
		});
	});

	it('passes Stripe webhook signature verification with raw body and endpoint secret', () => {
		const findings = byId(
			analyzeBillingReadiness([stripeManifest], [
				{
					path: 'src/routes/api/webhooks/stripe/+server.ts',
					text: `
const payload = await request.text();
const signature = request.headers.get('stripe-signature');
const event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
`
				}
			])
		);

		expect(findings['webhook-signature-missing']).toMatchObject({
			status: 'pass'
		});
	});

	it('warns when webhook code only handles completed checkout and ignores failure or cancellation states', () => {
		const findings = byId(
			analyzeBillingReadiness([stripeManifest], [
				{
					path: 'src/routes/api/webhooks/stripe/+server.ts',
					text: `
const event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
switch (event.type) {
  case 'checkout.session.completed':
    await markPaid(event.data.object);
    break;
}
`
				}
			])
		);

		expect(findings['webhook-event-coverage']).toMatchObject({
			status: 'warn',
			category: 'payments',
			launchImpact: 'fix-soon'
		});
	});

	it('passes webhook event coverage when success, failed payment, and subscription cancellation events are handled', () => {
		const findings = byId(
			analyzeBillingReadiness([stripeManifest], [
				{
					path: 'src/routes/api/webhooks/stripe/+server.ts',
					text: `
const event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
switch (event.type) {
  case 'checkout.session.completed':
  case 'checkout.session.async_payment_succeeded':
    await grantAccess(event.data.object);
    break;
  case 'checkout.session.async_payment_failed':
  case 'invoice.payment_failed':
    await recordPaymentFailure(event.data.object);
    break;
  case 'customer.subscription.deleted':
    await revokeAccess(event.data.object);
    break;
}
`
				}
			])
		);

		expect(findings['webhook-event-coverage']).toMatchObject({
			status: 'pass'
		});
	});

	it('warns when paid webhook events do not appear to update entitlement state', () => {
		const findings = byId(
			analyzeBillingReadiness([stripeManifest], [
				{
					path: 'src/routes/api/webhooks/stripe/+server.ts',
					text: `
const event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
if (event.type === 'checkout.session.completed') console.log(event.id);
`
				}
			])
		);

		expect(findings['entitlement-fulfillment']).toMatchObject({
			status: 'warn',
			category: 'payments'
		});
	});

	it('passes when paid webhook events grant and revoke access', () => {
		const findings = byId(
			analyzeBillingReadiness([stripeManifest], [
				{
					path: 'src/routes/api/webhooks/stripe/+server.ts',
					text: `
const event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
if (event.type === 'checkout.session.completed') await entitlements.grantAccess(event.data.object.customer);
if (event.type === 'customer.subscription.deleted') await entitlements.revokeAccess(event.data.object.customer);
`
				}
			])
		);

		expect(findings['entitlement-fulfillment']).toMatchObject({
			status: 'pass'
		});
	});

	it('passes customer billing portal support', () => {
		const findings = byId(
			analyzeBillingReadiness([stripeManifest], [
				{
					path: 'src/routes/account/billing/+server.ts',
					text: 'await stripe.billingPortal.sessions.create({ customer, return_url });'
				}
			])
		);

		expect(findings['billing-portal']).toMatchObject({
			status: 'pass'
		});
	});

	it('fails live secret keys committed in payment files', () => {
		const findings = byId(
			analyzeBillingReadiness([stripeManifest], [
				{
					path: 'src/lib/payments.ts',
					text: `const stripe = new Stripe("sk_live_${'a'.repeat(24)}");`
				}
			])
		);

		expect(findings['payment-env-safety']).toMatchObject({
			status: 'fail',
			category: 'payments',
			launchImpact: 'blocker'
		});
	});

	it('passes when payment files use environment bindings instead of literal live secrets', () => {
		const findings = byId(
			analyzeBillingReadiness([stripeManifest], [
				{
					path: 'src/lib/payments.ts',
					text: 'const stripe = new Stripe(env.STRIPE_SECRET_KEY);'
				}
			])
		);

		expect(findings['payment-env-safety']).toMatchObject({
			status: 'pass'
		});
	});
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/payments.test.ts
```

Expected: FAIL because `./payments` does not exist.

- [ ] **Step 3: Create the payment analyzer implementation**

Create `apps/preflight/src/lib/scan/repo/payments.ts`:

```ts
import { normalizeRepoFinding, type RepoFinding } from '$lib/scan/repo/findings';
import type { PackageManifestEvidence, RepoFileEvidence } from '$lib/scan/repo/readiness';
import type { ScanCheck } from '$lib/scan/types';

export type PaymentReadinessFinding = RepoFinding;

const PAYMENT_PROVIDER_DEPENDENCIES = [
	'stripe',
	'@stripe/stripe-js',
	'@stripe/react-stripe-js',
	'paddle-js',
	'@paddle/paddle-js',
	'lemonsqueezy.js',
	'@lemonsqueezy/lemonsqueezy.js'
];

const LIVE_SECRET_KEY = /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/;

function finding(
	id: string,
	title: string,
	status: ScanCheck['status'],
	message: string,
	evidence?: PaymentReadinessFinding['evidence']
): PaymentReadinessFinding {
	return normalizeRepoFinding({ id, category: 'payments', title, status, message, evidence });
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

function fileMatching(
	files: RepoFileEvidence[],
	pattern: RegExp
): RepoFileEvidence | undefined {
	return files.find((file) => pattern.test(file.path) || pattern.test(file.text ?? ''));
}

function paymentProviderDetected(
	manifests: PackageManifestEvidence[],
	files: RepoFileEvidence[]
): boolean {
	if (manifestsHaveDependency(manifests, PAYMENT_PROVIDER_DEPENDENCIES)) return true;
	const text = combinedFileText(files);
	return /\b(stripe\.checkout|checkout\.sessions\.create|PaymentIntent|price_[A-Za-z0-9]+|Stripe\(|stripe\.webhooks|billingPortal\.sessions\.create|paddle|lemonSqueezy|lemonsqueezy)\b/i.test(
		text
	);
}

function checkoutFile(files: RepoFileEvidence[]): RepoFileEvidence | undefined {
	return fileMatching(files, /\b(checkout\.sessions\.create|billingPortal\.sessions\.create)\b/i);
}

function clientOnlyPaymentSignal(files: RepoFileEvidence[]): RepoFileEvidence | undefined {
	return files.find((file) => {
		const text = file.text ?? '';
		return (
			/\.(svelte|jsx|tsx|js|ts)$/.test(file.path) &&
			/\b(loadStripe|Stripe\(|pk_live_|pk_test_)\b/.test(text) &&
			!/checkout\.sessions\.create|billingPortal\.sessions\.create|stripe\.webhooks/i.test(text)
		);
	});
}

function webhookSignal(files: RepoFileEvidence[]): RepoFileEvidence | undefined {
	return files.find((file) => {
		const text = file.text ?? '';
		return (
			/webhook/i.test(file.path) ||
			/\b(checkout\.session\.completed|customer\.subscription|invoice\.payment_failed|stripe-signature|webhook)\b/i.test(
				text
			)
		);
	});
}

function hasWebhookSignatureVerification(files: RepoFileEvidence[]): boolean {
	const text = combinedFileText(files);
	return /stripe\.webhooks\.constructEvent(?:Async)?\b|constructEventAsync\b|STRIPE_WEBHOOK_SECRET|webhookSecret/i.test(
		text
	);
}

function handledStripeEvents(files: RepoFileEvidence[]): Set<string> {
	const events = new Set<string>();
	for (const file of files) {
		const text = file.text ?? '';
		for (const match of text.matchAll(
			/\b(checkout\.session\.(?:completed|async_payment_succeeded|async_payment_failed)|customer\.subscription\.(?:created|updated|deleted|trial_will_end)|invoice\.(?:paid|payment_failed))\b/g
		)) {
			if (match[1]) events.add(match[1]);
		}
	}
	return events;
}

function eventCoverageFinding(files: RepoFileEvidence[]): PaymentReadinessFinding {
	const events = handledStripeEvents(files);
	const success = events.has('checkout.session.completed') || events.has('invoice.paid');
	const delayedSuccess = events.has('checkout.session.async_payment_succeeded');
	const failure =
		events.has('checkout.session.async_payment_failed') || events.has('invoice.payment_failed');
	const cancellation = events.has('customer.subscription.deleted');
	const shown = [...events].toSorted().join(', ');

	if (success && delayedSuccess && failure && cancellation) {
		return finding(
			'webhook-event-coverage',
			'Payment lifecycle events',
			'pass',
			`Webhook code handles paid, delayed-success, failed-payment, and subscription cancellation events: ${shown}.`,
			{ path: webhookSignal(files)?.path, snippet: shown }
		);
	}

	if (events.size === 0) {
		return finding(
			'webhook-event-coverage',
			'Payment lifecycle events',
			'warn',
			'Payment provider code was found, but no Stripe lifecycle events were detected in sampled webhook code.',
			{ path: webhookSignal(files)?.path }
		);
	}

	return finding(
		'webhook-event-coverage',
		'Payment lifecycle events',
		'warn',
		`Webhook event coverage is partial. Detected: ${shown}. Include paid, delayed-success, failed-payment, and subscription cancellation paths before charging users.`,
		{ path: webhookSignal(files)?.path, snippet: shown }
	);
}

function hasEntitlementFulfillment(files: RepoFileEvidence[]): boolean {
	const text = combinedFileText(files);
	return /\b(grantAccess|revokeAccess|entitlement|subscription.*active|setUserSubscriptionIsActive|markPaid|unlock|fulfill|provision|deprovision)\b/i.test(
		text
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

function paymentSecretFinding(files: RepoFileEvidence[]): PaymentReadinessFinding {
	const leaked = files.find((file) => LIVE_SECRET_KEY.test(file.text ?? ''));
	if (leaked) {
		return finding(
			'payment-env-safety',
			'Payment secret handling',
			'fail',
			`A live Stripe secret-like key appears in sampled payment code at ${leaked.path}. Rotate it and move payment secrets to server environment bindings.`,
			{ path: leaked.path }
		);
	}

	return finding(
		'payment-env-safety',
		'Payment secret handling',
		'pass',
		'No live Stripe secret-like literals were found in sampled payment files.'
	);
}

export function analyzeBillingReadiness(
	manifests: PackageManifestEvidence[],
	files: RepoFileEvidence[]
): PaymentReadinessFinding[] {
	if (!paymentProviderDetected(manifests, files)) return [];

	const checkout = checkoutFile(files);
	const clientOnly = clientOnlyPaymentSignal(files);
	const webhook = webhookSignal(files);
	const verifiesWebhook = hasWebhookSignatureVerification(files);
	const hasPortal = hasBillingPortalSignal(files);
	const fulfillsEntitlement = hasEntitlementFulfillment(files);

	return [
		finding(
			'checkout-server-owned',
			'Server-owned checkout',
			checkout ? 'pass' : clientOnly ? 'fail' : 'warn',
			checkout
				? `Server-side checkout or billing session creation found at ${checkout.path}.`
				: clientOnly
					? `Client-side Stripe initialization was found at ${clientOnly.path}, but no server-side checkout session creation was sampled. Create Checkout Sessions on the server before taking payments.`
					: 'Payment provider code was found, but no server-side checkout session creation was sampled.',
			{ path: checkout?.path ?? clientOnly?.path }
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
			{ path: webhook?.path }
		),
		eventCoverageFinding(files),
		finding(
			'entitlement-fulfillment',
			'Entitlement fulfillment',
			fulfillsEntitlement ? 'pass' : 'warn',
			fulfillsEntitlement
				? 'Payment lifecycle code appears to grant or revoke product access.'
				: 'Payment lifecycle code was found, but sampled files do not show access being granted, unlocked, provisioned, or revoked.',
			{ path: webhook?.path ?? checkout?.path }
		),
		finding(
			'billing-portal',
			'Customer billing portal',
			hasPortal ? 'pass' : 'warn',
			hasPortal
				? 'Customer billing management or portal handling is present.'
				: 'Stripe-like subscription code was found, but no customer billing portal or billing-management route was detected.',
			{ path: files.find((file) => /billing/i.test(file.path))?.path }
		),
		paymentSecretFinding(files)
	];
}
```

- [ ] **Step 4: Re-export the analyzer from readiness**

In `apps/preflight/src/lib/scan/repo/readiness.ts`, delete the current payment-specific helper block that starts at `const PAYMENT_PROVIDER_DEPENDENCIES = ...` and ends after `export function analyzeBillingReadiness(...)`. Add this export near the top after the imports:

```ts
export { analyzeBillingReadiness } from '$lib/scan/repo/payments';
```

- [ ] **Step 5: Run the focused tests**

Run:

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/payments.test.ts src/lib/scan/repo/readiness.test.ts
```

Expected: PASS. If `readiness.test.ts` still contains the old billing analyzer tests, either keep them passing through the re-export or move those cases into `payments.test.ts` and remove duplicate cases from `readiness.test.ts`.

- [ ] **Step 6: Commit Task 1**

Run:

```powershell
git add apps/preflight/src/lib/scan/repo/payments.ts apps/preflight/src/lib/scan/repo/payments.test.ts apps/preflight/src/lib/scan/repo/readiness.ts apps/preflight/src/lib/scan/repo/readiness.test.ts
git commit -m "feat: add payment readiness repo analyzer"
```

---

### Task 2: Load High-Signal Payment Files During Repo Scans

**Files:**
- Modify: `apps/preflight/src/lib/scan/repo/scan.ts`
- Test: `apps/preflight/src/lib/scan/repo/scan.test.ts`

- [ ] **Step 1: Add a failing repo integration test**

In `apps/preflight/src/lib/scan/repo/scan.test.ts`, add this test inside `describe('scanRepo', () => { ... })`:

```ts
it('loads payment route files so repo scans judge revenue readiness', async () => {
	const report = await scanRepo(REF, {
		fetchers: fakeFetchers({
			entries: [
				...CLEAN_ENTRIES,
				{ path: 'src/routes/api/checkout/+server.ts', type: 'blob' },
				{ path: 'src/routes/api/webhooks/stripe/+server.ts', type: 'blob' },
				{ path: 'src/lib/entitlements.ts', type: 'blob' },
				{ path: 'src/routes/account/billing/+server.ts', type: 'blob' }
			],
			files: {
				...CLEAN_FILES,
				'package.json': JSON.stringify({
					dependencies: { stripe: '^20.0.0' },
					scripts: { test: 'vitest run', build: 'vite build' }
				}),
				'src/routes/api/checkout/+server.ts':
					"await stripe.checkout.sessions.create({ mode: 'subscription' });",
				'src/routes/api/webhooks/stripe/+server.ts': `
const event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
if (event.type === 'checkout.session.completed') await grantAccess(event.data.object.customer);
if (event.type === 'checkout.session.async_payment_succeeded') await grantAccess(event.data.object.customer);
if (event.type === 'checkout.session.async_payment_failed') await recordPaymentFailure(event.data.object.customer);
if (event.type === 'invoice.payment_failed') await recordPaymentFailure(event.data.object.customer);
if (event.type === 'customer.subscription.deleted') await revokeAccess(event.data.object.customer);
`,
				'src/lib/entitlements.ts':
					'export async function grantAccess() {} export async function revokeAccess() {}',
				'src/routes/account/billing/+server.ts':
					'await stripe.billingPortal.sessions.create({ customer });'
			}
		}),
		npmLicense: async () => 'MIT',
		vulnAuditor: async () => null
	});

	const byId = Object.fromEntries(report.checks.map((check) => [check.id, check]));
	expect(byId['checkout-server-owned']).toMatchObject({ status: 'pass', category: 'payments' });
	expect(byId['webhook-signature-missing']).toMatchObject({ status: 'pass', category: 'payments' });
	expect(byId['webhook-event-coverage']).toMatchObject({ status: 'pass', category: 'payments' });
	expect(byId['entitlement-fulfillment']).toMatchObject({ status: 'pass', category: 'payments' });
	expect(byId['billing-portal']).toMatchObject({ status: 'pass', category: 'payments' });
	expect(byId['payment-env-safety']).toMatchObject({ status: 'pass', category: 'payments' });
	expect(report.repo?.filesSampled).toEqual(
		expect.arrayContaining([
			'src/routes/api/checkout/+server.ts',
			'src/routes/api/webhooks/stripe/+server.ts',
			'src/lib/entitlements.ts',
			'src/routes/account/billing/+server.ts'
		])
	);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/scan.test.ts -t "loads payment route files"
```

Expected: FAIL until `scan.ts` samples payment paths beyond generic config files and the eight source samples.

- [ ] **Step 3: Add payment file path selection**

In `apps/preflight/src/lib/scan/repo/scan.ts`, add this helper near `findStaticConfigPaths`:

```ts
const PAYMENT_FILE_LIMIT = 16;

function findPaymentFilePaths(entries: RepoTreeEntry[]): string[] {
	const patterns = [
		/(^|\/)(checkout|billing|payment|payments|stripe|subscription|subscriptions|entitlement|entitlements)(\/|\.|-|_)/i,
		/(^|\/)src\/routes\/api\/webhooks\/[^/]+\/\+server\.(ts|js)$/i,
		/(^|\/)src\/routes\/api\/checkout\/\+server\.(ts|js)$/i,
		/(^|\/)src\/routes\/account\/billing\/\+server\.(ts|js)$/i
	];

	return entries
		.filter((entry) => entry.type === 'blob' && !isVendoredPath(entry.path))
		.map((entry) => entry.path)
		.filter((path) => patterns.some((pattern) => pattern.test(path)))
		.slice(0, PAYMENT_FILE_LIMIT);
}
```

Then in `scanRepo`, after `const staticConfigPaths = findStaticConfigPaths(entries);`, add:

```ts
const paymentFilePaths = findPaymentFilePaths(entries);
```

Update the `Promise.all` destructuring to fetch the new paths:

```ts
const [
	packageJsonTexts,
	readmeText,
	gitignoreText,
	lockfileTexts,
	tsconfigText,
	envTexts,
	sampleTexts,
	staticConfigTexts,
	paymentFileTexts
] = await Promise.all([
	Promise.all(packageJsonPaths.map((path) => getFile(path))),
	getFile(readmePath),
	getFile(gitignorePath),
	Promise.all(lockfilePaths.map((path) => getFile(path, MAX_LOCKFILE_BYTES))),
	getFile(tsconfigPath),
	Promise.all(envFiles.slice(0, 2).map((p) => getFile(p))),
	Promise.all(sampleFiles.map((p) => getFile(p))),
	Promise.all(staticConfigPaths.map((path) => getFile(path, MAX_LOCKFILE_BYTES))),
	Promise.all(paymentFilePaths.map((path) => getFile(path, MAX_LOCKFILE_BYTES)))
]);
```

Create the file evidence and include it in repo analysis:

```ts
const paymentFiles: RepoFileEvidence[] = paymentFilePaths.map((path, index) => ({
	path,
	text: paymentFileTexts[index] ?? null
}));
const repoFiles = [...staticFiles, ...sourceFiles, ...paymentFiles];
```

Add payment paths to `repo.filesSampled`:

```ts
...paymentFilePaths,
```

- [ ] **Step 4: Run the repo scan tests**

Run:

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/scan.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Run:

```powershell
git add apps/preflight/src/lib/scan/repo/scan.ts apps/preflight/src/lib/scan/repo/scan.test.ts
git commit -m "feat: sample payment files in repo scans"
```

---

### Task 3: Catalog, Prompts, and Priority Wiring

**Files:**
- Modify: `apps/preflight/src/lib/scan/catalog.ts`
- Modify: `apps/preflight/src/lib/scan/prompts.ts`
- Modify: `apps/preflight/src/lib/scan/p0-ids.ts`
- Modify: `apps/preflight/src/lib/scan/verdict.ts`
- Test: `apps/preflight/src/lib/scan/check-quality.test.ts`
- Test: `apps/preflight/src/lib/scan/prompts.test.ts`
- Test: `apps/preflight/src/lib/scan/verdict.test.ts`

- [ ] **Step 1: Run the guardrail test and verify it fails**

Run:

```powershell
npm.cmd run test -w preflight -- src/lib/scan/check-quality.test.ts
```

Expected: FAIL because the new emitted check ids are not cataloged yet.

- [ ] **Step 2: Add catalog entries**

In `apps/preflight/src/lib/scan/catalog.ts`, add these entries to `BASE_CHECK_CATALOG` in alphabetical order:

```ts
	'checkout-server-owned': {
		id: 'checkout-server-owned',
		why: 'Paid SaaS launches should create checkout sessions on the server so prices, customer identity, and success URLs cannot be forged from browser code.',
		detectedBy:
			'Scans payment-related repository files for Stripe Checkout Session or billing session creation and compares that with client-side Stripe initialization signals.',
		falsePositive:
			'Checkout may be owned by a separate private service; in that case, keep this public repo from implying that browser-only code controls payments.'
	},
	'entitlement-fulfillment': {
		id: 'entitlement-fulfillment',
		why: 'A successful payment must grant access and a cancellation or failed renewal must remove access, or revenue and product state will diverge.',
		detectedBy:
			'Scans sampled payment files for fulfillment signals such as grantAccess, revokeAccess, entitlement, subscription-active, unlock, provision, or deprovision calls.',
		falsePositive:
			'Entitlements may live in another service, but the launch repo should either call that service or make the boundary obvious in payment code.'
	},
	'payment-env-safety': {
		id: 'payment-env-safety',
		why: 'Live payment secrets in source code can let attackers create charges, inspect customers, or mutate subscriptions if the repo or bundle leaks.',
		detectedBy:
			'Scans sampled payment files for live Stripe secret-like key literals and treats server environment bindings as the expected pattern.',
		falsePositive:
			'Generated docs can contain fake-looking keys; real code paths should still avoid live secret literals entirely.'
	},
	'webhook-event-coverage': {
		id: 'webhook-event-coverage',
		why: 'Subscriptions and delayed payment methods need more than checkout.session.completed; failed, delayed, and canceled states must update product access.',
		detectedBy:
			'Scans Stripe webhook code for checkout success, delayed success, failed payment, invoice failure, and subscription cancellation event names.',
		falsePositive:
			'Some products sell one-time payments only, but SaaS subscription code should handle the full lifecycle before charging users.'
	},
```

- [ ] **Step 3: Add fix prompts**

In `apps/preflight/src/lib/scan/prompts.ts`, update the `stripe` template and add these templates:

```ts
		stripe: `${base}Verify Stripe before launch: create Checkout Sessions server-side, keep live secret keys in server env vars only, validate webhooks with Stripe-Signature and the endpoint secret, fulfill access only after paid/completed events, handle failed/canceled subscription states, and offer customer billing self-service.`,
		'checkout-server-owned': `${base}Move payment session creation to a server endpoint. Browser code may load Stripe.js with a publishable key, but prices, customer IDs, success/cancel URLs, and Checkout Session creation must be controlled server-side. Add a route such as /api/checkout that calls stripe.checkout.sessions.create with server env vars, then redirect the browser to the returned session URL.`,
		'webhook-event-coverage': `${base}Expand payment webhook handling. For Stripe subscriptions, handle checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, invoice.payment_failed, and customer.subscription.deleted. Acknowledge valid events quickly, then update access state in an idempotent fulfillment function.`,
		'entitlement-fulfillment': `${base}Connect payment events to product access. On paid/completed events, grant or unlock the user/account. On failed payment, cancellation, refund, or deleted subscription events, record the state and revoke access when the grace policy says to. Store the Stripe customer/subscription IDs so repeat events are idempotent.`,
		'payment-env-safety': `${base}Remove live payment secret literals from source. Rotate any exposed Stripe secret or restricted key, move it into your hosting provider's server-side env/secret store, and instantiate Stripe only from that server binding. Keep publishable keys in browser code only.`,
```

- [ ] **Step 4: Set priorities**

In `apps/preflight/src/lib/scan/p0-ids.ts`, add these ids to the exported P0 set:

```ts
'checkout-server-owned',
'payment-env-safety',
'webhook-signature-missing',
```

In `apps/preflight/src/lib/scan/verdict.ts`, add these ids to `P1_IDS`:

```ts
'billing-portal',
'entitlement-fulfillment',
'webhook-event-coverage',
```

- [ ] **Step 5: Add focused prompt and verdict tests**

In `apps/preflight/src/lib/scan/prompts.test.ts`, add:

```ts
it('gives concrete payment readiness repair guidance', () => {
	const prompt = fixPrompt('webhook-event-coverage', {
		url: 'https://github.com/acme/app',
		message: 'Detected: checkout.session.completed'
	});

	expect(prompt).toContain('checkout.session.async_payment_failed');
	expect(prompt).toContain('customer.subscription.deleted');
	expect(prompt).toContain('idempotent fulfillment');
});
```

In `apps/preflight/src/lib/scan/verdict.test.ts`, add:

```ts
it('treats unsafe checkout ownership as a launch blocker', () => {
	const tagged = tagCheckPriorities([
		{
			id: 'checkout-server-owned',
			category: 'payments',
			title: 'Server-owned checkout',
			status: 'fail',
			message: 'Client-only Stripe checkout',
			fixPrompt: 'fix'
		}
	]);

	expect(tagged[0].priority).toBe('p0');
	expect(computeVerdict(tagged, 90)).toMatchObject({
		verdict: 'no-go'
	});
});
```

- [ ] **Step 6: Run the focused scan guardrails**

Run:

```powershell
npm.cmd run test -w preflight -- src/lib/scan/check-quality.test.ts src/lib/scan/prompts.test.ts src/lib/scan/verdict.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

Run:

```powershell
git add apps/preflight/src/lib/scan/catalog.ts apps/preflight/src/lib/scan/prompts.ts apps/preflight/src/lib/scan/p0-ids.ts apps/preflight/src/lib/scan/verdict.ts apps/preflight/src/lib/scan/check-quality.test.ts apps/preflight/src/lib/scan/prompts.test.ts apps/preflight/src/lib/scan/verdict.test.ts
git commit -m "feat: prioritize payment readiness findings"
```

---

### Task 4: Sharpen Visible Product Positioning

**Files:**
- Modify: `apps/preflight/src/routes/+page.svelte`
- Test: `apps/preflight/e2e/home.spec.ts`

- [ ] **Step 1: Add a failing homepage E2E assertion**

In `apps/preflight/e2e/home.spec.ts`, add an assertion to the main homepage test:

```ts
await expect(page.getByRole('heading', { name: /can this ai-built saas safely take money/i })).toBeVisible();
await expect(page.getByText(/checkout, signed webhooks, entitlements, billing self-service/i)).toBeVisible();
```

- [ ] **Step 2: Run the focused E2E and verify it fails**

Run:

```powershell
npm.cmd run test:e2e -w preflight -- e2e/home.spec.ts
```

Expected: FAIL until the homepage copy changes.

- [ ] **Step 3: Update homepage hero copy**

In `apps/preflight/src/routes/+page.svelte`, replace:

```svelte
<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">
	Before you post your URL anywhere public
</p>
<h1 class="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
	Should you post this URL today?
</h1>
```

with:

```svelte
<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">
	Before your AI-built SaaS charges users
</p>
<h1 class="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
	Can this AI-built SaaS safely take money?
</h1>
```

Replace the first hero paragraph with:

```svelte
<p class="mx-auto max-w-2xl text-lg text-zinc-400">
	<strong class="font-medium text-zinc-300">Revenue-readiness checks in seconds</strong>
	- checkout, signed webhooks, entitlements, billing self-service, exposed secrets, SEO blockers,
	legal gaps, and launch polish. Paste a live URL or a public
	<strong class="font-medium text-zinc-300">GitHub repo</strong>. Free scans show the verdict and
	one sample prompt. Subscribe from
	<span class="font-medium text-zinc-300">{ALPHA_PRICE_PREVIEW.later}</span>
	for every fix prompt, master repair paste, MCP access, and recurring monitoring.
	<a
		href="/compare"
		class="font-medium text-sky-300 underline underline-offset-4 hover:text-sky-200"
	>
		See how we compare ->
	</a>
</p>
```

Use the ASCII arrow `->` here to avoid adding another mojibake glyph in this already mixed-encoding file.

- [ ] **Step 4: Run the focused E2E**

Run:

```powershell
npm.cmd run test:e2e -w preflight -- e2e/home.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

Run:

```powershell
git add apps/preflight/src/routes/+page.svelte apps/preflight/e2e/home.spec.ts
git commit -m "feat: position deploylint around payment readiness"
```

---

### Task 5: Full Verification and Release Notes

**Files:**
- Modify: `apps/preflight/CHANGELOG.md`

- [ ] **Step 1: Run the full Preflight verification**

Run:

```powershell
npm.cmd run verify -w preflight
```

Expected: PASS. This runs sync, Svelte typecheck, lint, coverage, and build.

- [ ] **Step 2: Run the Preflight MCP verification**

Run:

```powershell
npm.cmd run verify -w preflight-mcp
```

Expected: PASS. This verifies the MCP-facing gate/report formatting still compiles and tests against the expanded check set.

- [ ] **Step 3: Run the targeted E2E smoke**

Run:

```powershell
npm.cmd run test:e2e -w preflight -- e2e/home.spec.ts e2e/scan-flow.spec.ts e2e/developers.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Add a changelog entry**

In `apps/preflight/CHANGELOG.md`, add an entry at the top:

```md
## Unreleased

- Added payment-readiness repo findings for server-owned checkout, webhook lifecycle coverage, entitlement fulfillment, billing portal support, and payment secret handling.
- Updated Deploylint positioning around AI-built SaaS revenue readiness.
```

If an `## Unreleased` section already exists, add the bullets under it instead of creating a duplicate heading.

- [ ] **Step 5: Run final status and diff checks**

Run:

```powershell
git diff --check
git status --short
```

Expected: `git diff --check` prints no output. `git status --short` shows only files changed by this plan plus the pre-existing unrelated deleted docs.

- [ ] **Step 6: Commit Task 5**

Run:

```powershell
git add apps/preflight/CHANGELOG.md
git commit -m "docs: note payment readiness scanner"
```

---

## Self-Review

- Spec coverage: The plan implements the approved pivot by making "can this AI-built SaaS safely take money?" the first paid wedge, with URL positioning and deeper repo evidence.
- Code boundaries: Payment analysis moves into `repo/payments.ts`; `readiness.ts` keeps non-payment repo readiness; `scan.ts` owns repository file sampling.
- Test coverage: New payment analyzer tests cover every emitted id; repo integration verifies file sampling; check-quality verifies catalog and behavioral references; prompt/verdict tests cover product-critical guidance and blocker behavior; E2E verifies homepage positioning.
- Verification: Final commands run Preflight verify, Preflight MCP verify, targeted E2E, `git diff --check`, and `git status --short`.
