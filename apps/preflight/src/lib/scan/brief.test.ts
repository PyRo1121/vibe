import { describe, expect, it } from 'vitest';
import { buildLaunchBrief, embarrassmentLine } from './brief';
import type { ScanCheck, ScanReport } from '$lib/scan/types';

function check(id: string, status: ScanCheck['status'], category: ScanCheck['category'] = 'seo'): ScanCheck {
	return {
		id,
		category,
		title: id,
		status,
		message: 'test',
		fixPrompt: ''
	};
}

function report(overrides: Partial<ScanReport> = {}): ScanReport {
	return {
		url: 'https://app.test',
		finalUrl: 'https://app.test/',
		scannedAt: new Date().toISOString(),
		score: 85,
		verdict: 'go',
		verdictMessage: 'Clear to share',
		checks: [check('title', 'pass'), { ...check('privacy', 'pass'), category: 'legal' }],
		summary: { pass: 20, warn: 0, fail: 0 },
		socialPreview: { title: 'T', description: 'D', image: 'i', imageUrl: 'u', twitterCard: 'summary', issues: [], ready: true },
		...overrides
	};
}

describe('buildLaunchBrief', () => {
	it('builds a positive headline for GO verdicts', () => {
		const brief = buildLaunchBrief(report());
		expect(brief.headline).toContain('Ready to share');
		expect(brief.shareReady).toBe(true);
		expect(brief.categoryScores.length).toBeGreaterThan(0);
	});

	it('surfaces embarrassment risks from failing checks', () => {
		const brief = buildLaunchBrief(
			report({
				verdict: 'no-go',
				checks: [check('privacy', 'fail', 'legal'), check('open-graph', 'warn', 'seo')]
			})
		);
		expect(brief.embarrassmentRisks.length).toBeGreaterThan(0);
		expect(brief.embarrassmentRisks[0]).toContain('privacy');
	});

	it('uses incomplete messaging for blocked scans', () => {
		const brief = buildLaunchBrief(
			report({
				scanCoverage: 'blocked',
				verdict: 'no-go',
				checks: [check('reachable', 'fail', 'launch')]
			})
		);
		expect(brief.headline).toContain('incomplete');
		expect(brief.embarrassmentRisks[0]).toContain('error');
	});
});

describe('embarrassmentLine', () => {
	it('maps known checks to human copy', () => {
		expect(embarrassmentLine(check('secrets', 'fail'))).toContain('scraped');
	});
});
