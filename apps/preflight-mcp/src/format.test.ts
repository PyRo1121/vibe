import { describe, expect, it } from 'vitest';

import {
	buildAgentGatePayload,
	buildAgentScanPayload,
	encodeOutput,
	formatGateMarkdown,
	formatScanMarkdown
} from './format.js';
import type { ScanReport } from './types.js';

function report(overrides: Partial<ScanReport> = {}): ScanReport {
	return {
		url: 'https://app.test',
		finalUrl: 'https://app.test/',
		score: 72,
		verdict: 'no-go',
		verdictMessage: 'Fix blockers before launch',
		summary: { pass: 10, warn: 2, fail: 3 },
		checks: [
			{
				id: 'privacy',
				title: 'Privacy policy',
				status: 'fail',
				message: 'No privacy link',
				priority: 'p0',
				fixPrompt: 'Add a /privacy page.'
			},
			{
				id: 'open-graph',
				title: 'Open Graph',
				status: 'warn',
				message: 'Missing og:image',
				priority: 'p1',
				fixPrompt: ''
			}
		],
		launchBrief: {
			headline: 'Launch risk',
			embarrassmentRisks: ['Missing privacy policy is a trust killer on Product Hunt.']
		},
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
		reportId: 'abc12345',
		samplePromptId: 'privacy',
		...overrides
	};
}

describe('buildAgentScanPayload', () => {
	it('includes embarrassment risks and sample fix prompt', () => {
		const payload = buildAgentScanPayload(report());
		expect(payload.embarrassmentRisks[0]).toContain('privacy');
		expect(payload.issues.find((i) => i.id === 'privacy')?.fixPrompt).toContain('/privacy');
		expect(payload.reportUrl).toContain('/r/abc12345');
		expect(payload.unlockHint).toBeNull();
		expect(payload.paymentReadiness?.status).toBe('blocked');
		expect(payload.paymentBlockers).toEqual(['Server-owned checkout: Checkout is browser-owned.']);
		expect(payload.revenueBlockers).toEqual(['Server-owned checkout: Checkout is browser-owned.']);
	});

	it('hints unlock when prompts are redacted', () => {
		const payload = buildAgentScanPayload(
			report({
				checks: [
					{
						id: 'secrets',
						title: 'Secrets',
						status: 'fail',
						message: 'key found',
						priority: 'p0',
						fixPrompt: ''
					},
					{
						id: 'privacy',
						title: 'Privacy',
						status: 'fail',
						message: 'missing',
						priority: 'p0',
						fixPrompt: 'sample only'
					}
				],
				samplePromptId: 'privacy'
			})
		);
		expect(payload.unlockHint).toContain('unlock');
	});

	it('sorts non-passing issues by priority and honors max_issues', () => {
		const payload = buildAgentScanPayload(
			report({
				checks: [
					{
						id: 'p2-warning',
						title: 'P2 warning',
						status: 'warn',
						message: 'later',
						priority: 'p2'
					},
					{
						id: 'p0-failure',
						title: 'P0 failure',
						status: 'fail',
						message: 'now',
						priority: 'p0'
					},
					{
						id: 'p1-warning',
						title: 'P1 warning',
						status: 'warn',
						message: 'soon',
						priority: 'p1'
					},
					{
						id: 'passing',
						title: 'Passing',
						status: 'pass',
						message: 'ok'
					}
				]
			}),
			2
		);

		expect(payload.issues.map((issue) => issue.id)).toEqual(['p0-failure', 'p1-warning']);
	});

	it('returns empty defaults when optional report sections are absent', () => {
		const payload = buildAgentScanPayload(
			report({
				launchBrief: undefined,
				paymentReadiness: undefined,
				reportId: undefined,
				samplePromptId: undefined,
				masterPrompt: '   ',
				pagesScanned: undefined,
				checks: [
					{
						id: 'later',
						title: 'Later',
						status: 'warn',
						message: 'No priority defaults to p2.'
					}
				]
			})
		);

		expect(payload.reportUrl).toBeNull();
		expect(payload.embarrassmentRisks).toEqual([]);
		expect(payload.launchHeadline).toBeNull();
		expect(payload.paymentReadiness).toBeNull();
		expect(payload.paymentBlockers).toEqual([]);
		expect(payload.revenueBlockers).toEqual([]);
		expect(payload.masterPrompt).toBeNull();
		expect(payload.issues[0]).toMatchObject({ id: 'later', priority: undefined });
	});
});

describe('formatScanMarkdown', () => {
	it('renders fix prompt block for sample issue', () => {
		const md = formatScanMarkdown(report());
		expect(md).toContain('Embarrassment radar');
		expect(md).toContain('Add a /privacy page');
		expect(md).toContain('Payment readiness');
		expect(md).toContain('Payment blockers');
		expect(md).toContain('Server-owned checkout');
		expect(md).not.toContain('Revenue blockers');
	});

	it('renders optional repo, page, delta, and master prompt context', () => {
		const md = formatScanMarkdown(
			report({
				score: 88,
				previousScore: 72,
				scoreDelta: 16,
				pagesScanned: [
					{ url: 'https://app.test/', role: 'home' },
					{ url: 'https://app.test/pricing', role: 'pricing' }
				],
				repo: { owner: 'acme', repo: 'site', branch: 'main' },
				masterPrompt: 'Fix every issue.'
			})
		);

		expect(md).toContain('72');
		expect(md).toContain('+16');
		expect(md).toContain('acme/site@main');
		expect(md).toContain('home, pricing');
		expect(md).toContain('Master repair prompt');
	});

	it('skips not-detected payment readiness and renders negative score deltas', () => {
		const md = formatScanMarkdown(
			report({
				score: 60,
				previousScore: 72,
				scoreDelta: -12,
				paymentReadiness: {
					status: 'not-detected',
					headline: 'No payment flow detected.',
					pass: 0,
					warn: 0,
					fail: 0,
					checked: [],
					blockers: [],
					warnings: []
				},
				launchBrief: undefined,
				checks: []
			})
		);

		expect(md).toContain('72');
		expect(md).toContain('(-12)');
		expect(md).not.toContain('## Payment readiness');
		expect(md).not.toContain('## Issues');
	});
});

describe('gate output', () => {
	it('keeps advisory payloads non-blocking without dropping failure reasons', () => {
		const payload = buildAgentGatePayload(
			report(),
			{ pass: false, reasons: ['P0: Privacy policy - No privacy link'] },
			80,
			true
		);

		expect(payload.pass).toBe(true);
		expect(payload.advisory).toBe(true);
		expect(payload.reasons).toEqual(['P0: Privacy policy - No privacy link']);
	});

	it('renders blocking gate failures in markdown', () => {
		const md = formatGateMarkdown(
			report(),
			{ pass: false, reasons: ['Score 72 below minimum 80'] },
			80,
			false
		);

		expect(md).toContain('FAIL');
		expect(md).toContain('Gate failures');
		expect(md).toContain('Score 72 below minimum 80');
	});

	it('renders advisory gate failures as non-blocking markdown', () => {
		const md = formatGateMarkdown(
			report(),
			{ pass: false, reasons: ['P0: Privacy policy - No privacy link'] },
			80,
			true
		);

		expect(md).toContain('ADVISORY');
		expect(md).toContain('Gate failures');
		expect(md).toContain('P0: Privacy policy - No privacy link');
		expect(md).toContain('Advisory mode');
	});

	it('renders pass and clear advisory headers', () => {
		expect(formatGateMarkdown(report(), { pass: true, reasons: [] }, 80, false)).toContain('PASS');
		expect(formatGateMarkdown(report(), { pass: true, reasons: [] }, 80, true)).toContain(
			'ADVISORY'
		);
	});
});

describe('encodeOutput', () => {
	it('encodes JSON output and rejects markdown misuse', () => {
		expect(encodeOutput('json', { pass: true })).toContain('"pass": true');
		expect(() => encodeOutput('markdown', { pass: true })).toThrow('markdown handler');
	});
});
