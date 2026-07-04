import type { ScanReport } from '../src/lib/scan/types';

const scannedAt = '2026-07-04T12:00:00.000Z';

/** Rich site scan report for E2E — never hits real network. */
export const mockScanReport: ScanReport = {
	url: 'https://demo-app.test',
	finalUrl: 'https://demo-app.test/',
	scannedAt,
	score: 72,
	verdict: 'conditional',
	verdictMessage: 'Fix important issues before Product Hunt or paid traffic.',
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
	samplePromptId: 'privacy',
	socialPreview: {
		title: 'Demo App — Ship faster',
		description: 'A demo app for Preflight E2E tests.',
		image: 'https://demo-app.test/og.png',
		imageUrl: 'https://demo-app.test/og.png',
		twitterCard: 'summary_large_image',
		issues: ['og:description is missing.'],
		ready: false,
		imageReachable: true
	},
	launchBrief: {
		headline: 'Almost shareable — fix privacy and social preview before posting.',
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
	reportId: 'e2e-demo-report'
};

export const mockUnlockedReport: ScanReport = {
	...mockScanReport,
	unlocked: true,
	masterPrompt: 'Fix all launch blockers for https://demo-app.test in one pass.'
};

export const mockScanError = {
	message: 'Could not reach that URL — check the spelling or try again later.'
};
