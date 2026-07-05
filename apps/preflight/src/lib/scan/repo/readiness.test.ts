import { describe, expect, it } from 'vitest';
import {
	analyzeCiWorkflows,
	analyzeBillingReadiness,
	analyzeDeployConfig,
	analyzeLintSetup,
	analyzePackageManager,
	analyzePackageScripts,
	analyzeTypescriptSetup,
	type PackageManifestEvidence,
	type RepoFileEvidence,
	type RepoReadinessFinding
} from './readiness';

const rootManifest: PackageManifestEvidence = {
	path: 'package.json',
	json: {
		scripts: {
			lint: 'eslint .',
			test: 'vitest run',
			check: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json',
			build: 'vite build'
		},
		devDependencies: {
			eslint: '^9.0.0',
			'svelte-check': '^4.0.0'
		}
	}
};

describe('repo readiness analyzer', () => {
	it('returns normalized findings for package script readiness', () => {
		const findings: RepoReadinessFinding[] = analyzePackageScripts([rootManifest]);

		expect(findings.map((finding) => finding.id)).toContain('package-scripts');
		expect(findings.find((finding) => finding.id === 'package-scripts')).toMatchObject({
			category: 'launch',
			title: 'Package scripts',
			status: 'pass',
			engine: 'deploylint-static',
			confidence: 'high',
			launchImpact: 'watch',
			ruleId: 'package-scripts',
			fixPromptId: 'package-scripts'
		});
	});

	it('warns on missing root lint, test, and build scripts', () => {
		const findings = analyzePackageScripts([
			{
				path: 'package.json',
				json: { scripts: { dev: 'vite dev' } }
			}
		]);

		expect(findings.find((finding) => finding.id === 'package-scripts')).toMatchObject({
			status: 'warn',
			message: 'Root package.json is missing lint, test, build scripts.'
		});
		expect(findings.find((finding) => finding.id === 'lint-script')).toMatchObject({
			status: 'warn'
		});
		expect(findings.find((finding) => finding.id === 'build-script')).toMatchObject({
			status: 'warn'
		});
	});

	it('treats placeholder scripts as warnings', () => {
		const findings = analyzePackageScripts([
			{
				path: 'package.json',
				json: {
					scripts: {
						lint: 'eslint .',
						test: 'echo "no tests" && exit 0',
						build: 'true'
					}
				}
			}
		]);

		expect(findings.find((finding) => finding.id === 'package-scripts')?.message).toContain(
			'placeholder test, build scripts'
		);
		expect(findings.find((finding) => finding.id === 'build-script')).toMatchObject({
			status: 'warn',
			message: 'The build script in package.json is a placeholder.'
		});
	});

	it('warns when nested app scripts exist but root scripts do not expose them', () => {
		const findings = analyzePackageScripts([
			{ path: 'package.json', json: { scripts: { dev: 'turbo dev' } } },
			{
				path: 'apps/web/package.json',
				json: {
					scripts: {
						lint: 'eslint .',
						test: 'vitest run',
						build: 'vite build'
					}
				}
			}
		]);

		expect(findings.find((finding) => finding.id === 'package-scripts')?.message).toContain(
			'nested apps have scripts, but the root package.json does not expose lint, test, and build'
		);
	});

	it('passes modern ESLint flat config and warns when Prettier has no format script', () => {
		const files: RepoFileEvidence[] = [
			{ path: 'eslint.config.js', text: 'export default [];' },
			{ path: '.prettierrc', text: '{}' }
		];
		const findings = analyzeLintSetup([rootManifest], files);

		expect(findings.find((finding) => finding.id === 'lint-script')).toMatchObject({
			status: 'pass'
		});
		expect(findings.find((finding) => finding.id === 'format-script')).toMatchObject({
			status: 'warn',
			message: 'Prettier config exists, but root package.json has no format script.'
		});
	});

	it('treats Biome as first-class lint and format tooling', () => {
		const findings = analyzeLintSetup(
			[
				{
					path: 'package.json',
					json: {
						scripts: { lint: 'biome check .', format: 'biome format --write .' },
						devDependencies: { '@biomejs/biome': '^2.0.0' }
					}
				}
			],
			[{ path: 'biome.json', text: '{}' }]
		);

		expect(findings.find((finding) => finding.id === 'lint-script')).toMatchObject({
			status: 'pass'
		});
		expect(findings.find((finding) => finding.id === 'format-script')).toMatchObject({
			status: 'pass'
		});
	});

	it('detects SvelteKit projects missing svelte-check', () => {
		const findings = analyzeTypescriptSetup(
			[
				{
					path: 'package.json',
					json: {
						scripts: { build: 'vite build' },
						devDependencies: { '@sveltejs/kit': '^2.0.0', typescript: '^5.0.0' }
					}
				}
			],
			[{ path: 'tsconfig.json', text: JSON.stringify({ compilerOptions: { strict: true } }) }]
		);

		expect(findings.find((finding) => finding.id === 'svelte-check')).toMatchObject({
			status: 'warn'
		});
		expect(findings.find((finding) => finding.id === 'typecheck-script')).toMatchObject({
			status: 'warn'
		});
	});

	it('passes pinned package manager with matching lockfile', () => {
		const findings = analyzePackageManager(
			[
				{
					path: 'package.json',
					json: { packageManager: 'pnpm@10.0.0' }
				}
			],
			[{ path: 'pnpm-lock.yaml', text: 'lockfileVersion: 9.0' }]
		);

		expect(findings.find((finding) => finding.id === 'package-manager-pinned')).toMatchObject({
			status: 'pass'
		});
		expect(findings.find((finding) => finding.id === 'mixed-lockfiles')).toMatchObject({
			status: 'pass'
		});
	});

	it('warns on mixed lockfiles and package manager mismatch', () => {
		const findings = analyzePackageManager(
			[{ path: 'package.json', json: { packageManager: 'npm@11.0.0' } }],
			[
				{ path: 'package-lock.json', text: '{}' },
				{ path: 'pnpm-lock.yaml', text: 'lockfileVersion: 9.0' }
			]
		);

		expect(findings.find((finding) => finding.id === 'mixed-lockfiles')).toMatchObject({
			status: 'warn'
		});
		expect(findings.find((finding) => finding.id === 'package-manager-pinned')?.message).toContain(
			'does not match committed lockfile'
		);
	});

	it('passes CI workflows that run quality gates with least-privilege permissions', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/ci.yml',
				text: `
name: CI
on: [pull_request]
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run check
      - run: npm test
      - run: npm run build
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'ci-runs-quality-gates')).toMatchObject({
			status: 'pass'
		});
		expect(findings.find((finding) => finding.id === 'workflow-permissions')).toMatchObject({
			status: 'pass'
		});
	});

	it('passes dependency review and update automation when configured', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/dependency-review.yml',
				text: `
name: Dependency Review
on: [pull_request]
permissions:
  contents: read
  pull-requests: read
jobs:
  dependency-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/dependency-review-action@v4
`
			},
			{
				path: '.github/dependabot.yml',
				text: `
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'dependency-review-action')).toMatchObject({
			status: 'pass'
		});
		expect(findings.find((finding) => finding.id === 'dependabot-config')).toMatchObject({
			status: 'pass'
		});
	});

	it('warns when dependency review and update automation are missing', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/ci.yml',
				text: `
name: CI
on: [pull_request]
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'dependency-review-action')).toMatchObject({
			status: 'warn'
		});
		expect(findings.find((finding) => finding.id === 'dependabot-config')).toMatchObject({
			status: 'warn'
		});
	});

	it('warns when GitHub Actions workflows do not declare token permissions', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/ci.yml',
				text: `
name: CI
on: [pull_request]
jobs:
  verify:
    steps:
      - uses: actions/checkout@v4
      - run: npm test
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'workflow-permissions')).toMatchObject({
			status: 'warn'
		});
	});

	it('fails pull_request_target workflows with clear untrusted script execution', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/pr.yml',
				text: `
on: pull_request_target
permissions: write-all
jobs:
  label:
    steps:
      - run: echo "\${{ github.event.pull_request.title }}"
      - uses: third-party/action@main
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'workflow-pull-request-target')).toMatchObject(
			{
				status: 'fail'
			}
		);
		expect(findings.find((finding) => finding.id === 'workflow-permissions')).toMatchObject({
			status: 'warn'
		});
		expect(findings.find((finding) => finding.id === 'workflow-action-pinning')).toMatchObject({
			status: 'warn'
		});
	});

	it('fails pull_request_target workflows that opt into unsafe fork checkout', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/pr.yml',
				text: `
on: pull_request_target
permissions:
  contents: write
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          ref: \${{ github.event.pull_request.head.sha }}
          repository: \${{ github.event.pull_request.head.repo.full_name }}
          allow-unsafe-pr-checkout: true
      - run: npm test
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'workflow-pull-request-target')).toMatchObject(
			{
				status: 'fail',
				launchImpact: 'blocker'
			}
		);
	});

	it('ignores commented-out quality gates and floating action refs', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/ci.yml',
				text: `
name: CI
on: [pull_request]
permissions:
  contents: read
jobs:
  verify:
    steps:
      # - uses: third-party/action@main
      # - run: npm run lint
      # - run: npm run check
      # - run: npm test
      # - run: npm run build
      - uses: actions/checkout@v4
      - run: npm ci
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'ci-runs-quality-gates')).toMatchObject({
			status: 'warn'
		});
		expect(findings.find((finding) => finding.id === 'workflow-action-pinning')).toMatchObject({
			status: 'pass'
		});
	});

	it('detects multiline run blocks and quoted floating third-party action refs', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/ci.yml',
				text: `
name: CI
on: [pull_request]
permissions:
  contents: read
jobs:
  verify:
    steps:
      - uses: actions/checkout@v4
      - uses: "acme/deploy@main"
      - run: |
          npm run lint
          npm run check
          npm test
          npm run build
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'ci-runs-quality-gates')).toMatchObject({
			status: 'pass'
		});
		expect(findings.find((finding) => finding.id === 'workflow-action-pinning')).toMatchObject({
			status: 'warn'
		});
	});

	it('passes deploy config and warns on stale Wrangler compatibility date', () => {
		const findings = analyzeDeployConfig(
			[rootManifest],
			[
				{
					path: 'wrangler.jsonc',
					text: '{ "compatibility_date": "2025-01-01" }'
				}
			],
			new Date('2026-07-05T00:00:00Z')
		);

		expect(findings.find((finding) => finding.id === 'deploy-config')).toMatchObject({
			status: 'pass'
		});
		expect(findings.find((finding) => finding.id === 'wrangler-compat-date')).toMatchObject({
			status: 'warn'
		});
	});

	it('fails Dockerfiles that copy dotenv files into the image', () => {
		const findings = analyzeDeployConfig(
			[rootManifest],
			[{ path: 'Dockerfile', text: 'FROM node:22\nCOPY .env .env\nRUN npm ci\n' }],
			new Date('2026-07-05T00:00:00Z')
		);

		expect(findings.find((finding) => finding.id === 'docker-env-copy')).toMatchObject({
			status: 'fail'
		});
	});

	it('fails Stripe webhook handlers without signature verification', () => {
		const findings = analyzeBillingReadiness(
			[
				{
					path: 'package.json',
					json: { dependencies: { stripe: '^20.0.0' } }
				}
			],
			[
				{
					path: 'src/routes/api/webhooks/stripe/+server.ts',
					text: `
import Stripe from 'stripe';

export async function POST({ request }) {
  const event = await request.json();
  if (event.type === 'checkout.session.completed') return new Response('ok');
}
`
				}
			]
		);

		expect(findings.find((finding) => finding.id === 'webhook-signature-missing')).toMatchObject({
			status: 'fail',
			category: 'payments',
			launchImpact: 'blocker'
		});
	});

	it('passes Stripe webhook handlers with signature verification', () => {
		const findings = analyzeBillingReadiness(
			[
				{
					path: 'package.json',
					json: { dependencies: { stripe: '^20.0.0' } }
				}
			],
			[
				{
					path: 'src/routes/api/webhooks/stripe/+server.ts',
					text: `
const signature = request.headers.get('stripe-signature');
const event = stripe.webhooks.constructEvent(await request.text(), signature, env.STRIPE_WEBHOOK_SECRET);
`
				},
				{
					path: 'src/routes/account/billing/+server.ts',
					text: 'await stripe.billingPortal.sessions.create({ customer });'
				}
			]
		);

		expect(findings.find((finding) => finding.id === 'webhook-signature-missing')).toMatchObject({
			status: 'pass'
		});
		expect(findings.find((finding) => finding.id === 'billing-portal')).toMatchObject({
			status: 'pass'
		});
	});

	it('warns when Stripe subscription code has no customer billing portal signal', () => {
		const findings = analyzeBillingReadiness(
			[
				{
					path: 'package.json',
					json: { dependencies: { stripe: '^20.0.0' } }
				}
			],
			[
				{
					path: 'src/lib/checkout.ts',
					text: "await stripe.checkout.sessions.create({ mode: 'subscription', line_items: [] });"
				}
			]
		);

		expect(findings.find((finding) => finding.id === 'billing-portal')).toMatchObject({
			status: 'warn',
			category: 'payments',
			launchImpact: 'fix-soon'
		});
	});

	it('does not emit billing findings when no payment provider is detected', () => {
		const findings = analyzeBillingReadiness(
			[rootManifest],
			[{ path: 'src/routes/api/webhooks/github/+server.ts', text: 'export const POST = () => {};' }]
		);

		expect(findings).toEqual([]);
	});
});
