import { describe, expect, it } from 'vitest';
import { buildAgentScanPayload, formatScanMarkdown } from './format.js';
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
});

describe('formatScanMarkdown', () => {
	it('renders fix prompt block for sample issue', () => {
		const md = formatScanMarkdown(report());
		expect(md).toContain('Embarrassment radar');
		expect(md).toContain('Add a /privacy page');
	});
});
