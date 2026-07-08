import type { ScanReport } from '../src/lib/scan/types';

const scannedAt = '2026-07-04T12:00:00.000Z';

/** Rich site scan report for E2E — never hits real network. */
export const mockScanReport: ScanReport = {
	url: 'https://demo-app.test',
	finalUrl: 'https://demo-app.test/',
	scannedAt,
	score: 72,
	verdict: 'conditional',
	verdictMessage: 'Fix important issues before paid traffic or required deploy gates.',
	checks: [
		{
			id: 'privacy',
			category: 'legal',
			title: 'Privacy policy',
			status: 'fail',
			message: 'No privacy page linked from the homepage.',
			fixPrompt: 'Add a privacy policy page and link it from the footer.'
		},
		{
			id: 'open-graph',
			category: 'seo',
			title: 'Open Graph tags',
			status: 'warn',
			message: 'og:description is missing.',
			fixPrompt: 'Add og:description meta tag.'
		},
		{
			id: 'placeholder-copy',
			category: 'launch',
			title: 'Placeholder copy',
			status: 'warn',
			message: 'Found "Coming soon" on the homepage.',
			fixPrompt: 'Replace placeholder copy with real product language.'
		},
		{
			id: 'https',
			category: 'security',
			title: 'HTTPS',
			status: 'pass',
			message: 'Site is served over HTTPS.',
			fixPrompt: ''
		},
		{
			id: 'viewport',
			category: 'mobile',
			title: 'Mobile viewport',
			status: 'pass',
			message: 'Viewport meta tag present.',
			fixPrompt: ''
		}
	],
	summary: { pass: 2, warn: 2, fail: 1 },
	paymentReadiness: {
		status: 'blocked',
		headline: 'Payment readiness blocked by 1 payment blocker.',
		pass: 0,
		warn: 1,
		fail: 1,
		checked: ['checkout-server-owned', 'billing-portal'],
		blockers: ['Server-owned checkout: Checkout is browser-owned.'],
		warnings: ['Customer billing portal: No billing portal route.']
	},
	samplePromptId: 'privacy',
	socialPreview: {
		title: 'Demo App — Ship faster',
		description: 'A demo app for Deploylint E2E tests.',
		image: 'https://demo-app.test/og.png',
		imageUrl: 'https://demo-app.test/og.png',
		twitterCard: 'summary_large_image',
		issues: ['og:description is missing.'],
		ready: false,
		imageReachable: true
	},
	launchBrief: {
		headline: 'Almost ready for gate mode — fix privacy and social preview before rollout.',
		embarrassmentRisks: [
			'Someone will ask where your privacy policy is before they trust you.',
			'Your link will look broken when pasted on X, Slack, or Discord.'
		],
		shareReady: false,
		categoryScores: [
			{ category: 'legal', label: 'Legal', score: 40, pass: 0, warn: 0, fail: 1 },
			{ category: 'seo', label: 'SEO & social', score: 70, pass: 0, warn: 1, fail: 0 },
			{ category: 'security', label: 'Security', score: 100, pass: 1, warn: 0, fail: 0 },
			{ category: 'mobile', label: 'Mobile', score: 100, pass: 1, warn: 0, fail: 0 },
			{ category: 'launch', label: 'Launch polish', score: 50, pass: 0, warn: 1, fail: 0 }
		]
	},
	pagesScanned: [
		{ url: 'https://demo-app.test/', role: 'home', status: 200 },
		{ url: 'https://demo-app.test/privacy', role: 'privacy', status: 404 }
	],
	stack: ['SvelteKit', 'Cloudflare'],
	reportId: 'e2e-demo-report',
	unlocked: false,
	masterPrompt: undefined
};

/** Repository scan report for E2E — proves repo-first product surfaces render. */
export const mockRepoScanReport: ScanReport = {
	url: 'https://github.com/acme/control-plane',
	finalUrl: 'https://github.com/acme/control-plane',
	scannedAt,
	score: 79,
	verdict: 'conditional',
	verdictMessage: 'Repo is close, but license and CI findings should be fixed before handoff.',
	checks: [
		{
			id: 'env-committed',
			category: 'security',
			title: 'Committed .env files',
			status: 'pass',
			message: 'No .env files committed.',
			fixPrompt: 'Keep .env files ignored and rotate anything that was previously committed.'
		},
		{
			id: 'dependency-vulns',
			category: 'security',
			title: 'Known vulnerabilities (OSV)',
			status: 'pass',
			message: 'No known vulnerabilities across 128 lockfile dependencies (OSV.dev).',
			fixPrompt: 'Keep dependency updates automated and run OSV in CI.'
		},
		{
			id: 'repo-license',
			category: 'legal',
			title: 'Repo license & sell rights',
			status: 'pass',
			message: 'Repository license is MIT.',
			fixPrompt: 'Keep the LICENSE file current before commercial handoff.'
		},
		{
			id: 'license-risk',
			category: 'legal',
			title: 'Dependency licenses',
			status: 'warn',
			message:
				'1 dependency needs commercial-use review. Audited 2 direct dependencies and screened lockfile packages.',
			fixPrompt:
				'Replace risky dependencies or document the paid license before selling the project.'
		},
		{
			id: 'ci-config',
			category: 'launch',
			title: 'CI configured',
			status: 'warn',
			message: 'CI workflow found, but deploy protection is not wired to Deploylint gate mode.',
			fixPrompt: 'Add Deploylint gate mode to the pull request workflow before deploy.'
		},
		{
			id: 'tests-present',
			category: 'launch',
			title: 'Tests present',
			status: 'pass',
			message: 'Unit and Playwright test files found.',
			fixPrompt: 'Keep critical deploy and billing paths covered by tests.'
		}
	],
	summary: { pass: 4, warn: 2, fail: 0 },
	paymentReadiness: {
		status: 'needs-attention',
		headline: 'Revenue readiness needs attention before paid rollout.',
		pass: 2,
		warn: 1,
		fail: 0,
		checked: ['checkout-server-owned', 'signed-webhooks', 'billing-portal'],
		blockers: [],
		warnings: ['Deploylint gate mode is not enforced in CI before production deploys.']
	},
	samplePromptId: 'license-risk',
	launchBrief: {
		headline: 'Nearly ready for handoff — close the license and gate-mode gaps first.',
		embarrassmentRisks: [
			'A buyer or client will ask whether every dependency is safe for commercial use.',
			'Deploys can still bypass the readiness gate when CI does not enforce it.'
		],
		shareReady: false,
		categoryScores: [
			{ category: 'security', label: 'Security', score: 100, pass: 2, warn: 0, fail: 0 },
			{ category: 'legal', label: 'Legal', score: 75, pass: 1, warn: 1, fail: 0 },
			{ category: 'launch', label: 'Launch polish', score: 75, pass: 1, warn: 1, fail: 0 }
		]
	},
	licenseAudit: {
		sellable: 'risk',
		summary: '1 dependency needs commercial-use review before this repo is sold or handed off.',
		libraries: [
			{
				name: 'highcharts',
				version: '12.1.0',
				source: 'package.json',
				license: 'Highsoft Commercial License',
				spdx: null,
				category: 'commercial',
				sellable: 'risk',
				note: 'Commercial use requires a paid Highcharts license.'
			},
			{
				name: 'lodash',
				version: '4.17.21',
				source: 'package.json',
				license: 'MIT',
				spdx: 'MIT',
				category: 'permissive',
				sellable: 'yes',
				note: 'Permissive license generally allows commercial use with attribution.'
			}
		]
	},
	repo: {
		owner: 'acme',
		repo: 'control-plane',
		branch: 'main',
		description: 'Internal launch control plane for paid customer environments.',
		stars: 128,
		license: 'MIT',
		filesSampled: [
			'package.json',
			'package-lock.json',
			'.github/workflows/deploy.yml',
			'src/routes/billing/+server.ts',
			'src/lib/gate/evaluate.ts'
		],
		depCount: 2
	},
	stack: ['SvelteKit', 'Cloudflare'],
	reportId: 'e2e-repo-report',
	unlocked: false,
	masterPrompt: undefined
};
