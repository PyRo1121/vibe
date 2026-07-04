import { describe, expect, it } from 'vitest';
import type { ScanReport } from '$lib/scan/types';
import { sanitizeReport } from './report';

const sample: ScanReport = {
	url: 'https://app.test',
	finalUrl: 'https://app.test/',
	scannedAt: '2026-07-02T00:00:00.000Z',
	score: 50,
	verdict: 'conditional',
	verdictMessage: 'Fix issues',
	checks: [
		{
			id: 'title',
			category: 'seo',
			title: 'Page title',
			status: 'fail',
			message: 'Missing',
			priority: 'p1',
			fixPrompt: 'secret prompt text'
		},
		{
			id: 'privacy',
			category: 'legal',
			title: 'Privacy',
			status: 'fail',
			message: 'Missing',
			priority: 'p0',
			fixPrompt: 'privacy prompt'
		}
	],
	summary: { pass: 0, warn: 0, fail: 2 }
};

describe('sanitizeReport', () => {
	it('redacts fix prompts when locked except one sample', () => {
		const out = sanitizeReport(sample, false);
		expect(out.unlocked).toBe(false);
		expect(out.samplePromptId).toBe('privacy');
		expect(out.checks.find((c) => c.id === 'privacy')?.fixPrompt).toBe('privacy prompt');
		expect(out.checks.find((c) => c.id === 'title')?.fixPrompt).toBe('');
	});

	it('keeps fix prompts and master prompt when unlocked', () => {
		const out = sanitizeReport(sample, true);
		expect(out.unlocked).toBe(true);
		expect(out.checks.find((c) => c.id === 'title')?.fixPrompt).toBe('secret prompt text');
		expect(out.masterPrompt).toContain('https://app.test');
	});

	it('adds clamped score delta when re-scan baseline provided', () => {
		const out = sanitizeReport(sample, true, { previousScore: 40 });
		expect(out.previousScore).toBe(40);
		expect(out.scoreDelta).toBe(10);
	});
});
