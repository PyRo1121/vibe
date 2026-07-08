import type { ScanCheck, ScanReport } from '$lib/scan/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	buildShareText,
	buildUnlockOffer,
	computeFixProgress,
	loadBaselineChecks,
	saveBaselineChecks,
	STORAGE,
	toCheckSnapshots
} from './preflight-session';

function check(id: string, status: ScanCheck['status']): ScanCheck {
	return {
		id,
		category: 'seo',
		title: id,
		status,
		message: 'msg',
		fixPrompt: ''
	};
}

const baseReport: ScanReport = {
	url: 'https://app.test',
	finalUrl: 'https://app.test/',
	scannedAt: '2026-07-02T00:00:00.000Z',
	score: 88,
	verdict: 'go',
	verdictMessage: 'Ready to ship',
	checks: [],
	summary: { pass: 10, warn: 1, fail: 0 }
};

function stubSessionStorage(initial: Record<string, string> = {}) {
	const store = new Map(Object.entries(initial));
	const sessionStorage = {
		getItem: vi.fn<(key: string) => string | null>((key) => store.get(key) ?? null),
		setItem: vi.fn<(key: string, value: string) => void>((key, value) => {
			store.set(key, value);
		}),
		removeItem: vi.fn<(key: string) => void>((key) => {
			store.delete(key);
		}),
		clear: vi.fn<() => void>(() => {
			store.clear();
		})
	};
	vi.stubGlobal('sessionStorage', sessionStorage);
	return { sessionStorage, store };
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('buildShareText', () => {
	it('uses configured app URL and score', () => {
		const text = buildShareText(baseReport, 'https://deploylint.com');
		expect(text).toContain('https://deploylint.com');
		expect(text).toContain('88/100');
		expect(text).toContain('GO');
	});

	it('includes public deploy risk hook when launch brief exists', () => {
		const text = buildShareText(
			{
				...baseReport,
				verdict: 'no-go',
				launchBrief: {
					headline: 'blockers',
					embarrassmentRisks: ['Exposed keys get scraped within hours — rotate immediately.'],
					shareReady: false,
					categoryScores: []
				}
			},
			'https://deploylint.com'
		);
		expect(text).toContain('before this reaches production');
		expect(text).toContain('Exposed keys');
	});

	it('keeps score and verdict when a deploy risk hook and permalink are present', () => {
		const text = buildShareText(
			{
				...baseReport,
				score: 72,
				verdict: 'conditional',
				reportId: 'abc12345',
				launchBrief: {
					headline: 'risk',
					embarrassmentRisks: [
						'Someone will ask where your privacy policy is before they trust you.'
					],
					shareReady: false,
					categoryScores: []
				}
			},
			'https://deploylint.com'
		);

		expect(text).toContain('72/100');
		expect(text).toContain('CONDITIONAL GO');
		expect(text).toContain('https://deploylint.com/r/abc12345');
	});
});

describe('buildUnlockOffer', () => {
	it('returns null when already unlocked', () => {
		expect(buildUnlockOffer({ ...baseReport, unlocked: true })).toBeNull();
	});

	it('counts locked guided fixes excluding free sample', () => {
		const offer = buildUnlockOffer({
			...baseReport,
			verdict: 'conditional',
			checks: [check('privacy', 'fail'), check('title', 'warn')],
			samplePromptId: 'privacy'
		});
		expect(offer?.issueCount).toBe(2);
		expect(offer?.lockedPromptCount).toBe(1);
	});

	it('urgent headline for no-go', () => {
		const offer = buildUnlockOffer({
			...baseReport,
			verdict: 'no-go',
			checks: [check('privacy', 'fail')]
		});
		expect(offer?.headline).toContain('Gate not ready');
	});

	it('includes concrete workflow value pitch and projected score', () => {
		const offer = buildUnlockOffer({
			...baseReport,
			score: 62,
			verdict: 'no-go',
			summary: { pass: 8, warn: 2, fail: 3 },
			checks: [check('privacy', 'fail'), check('open-graph', 'fail'), check('title', 'warn')],
			samplePromptId: 'privacy'
		});
		expect(offer?.valuePitch).toContain('guided fix');
		expect(offer?.masterPreviewLines.length).toBeGreaterThan(2);
		expect(offer?.projectedScore).toBeGreaterThan(62);
	});

	it('does not sell a subscription before a blocked deploy target is reachable', () => {
		const offer = buildUnlockOffer({
			...baseReport,
			scanCoverage: 'blocked',
			verdict: 'no-go',
			checks: [check('reachable', 'fail')],
			samplePromptId: 'reachable'
		});

		expect(offer).toBeNull();
	});

	it('does not sell a subscription for blocked scans without a reachable or fetch check', () => {
		const offer = buildUnlockOffer({
			...baseReport,
			scanCoverage: 'blocked',
			verdict: 'no-go',
			checks: []
		});

		expect(offer).toBeNull();
	});

	it('offers verification proof when a no-go report has no locked fixes', () => {
		const offer = buildUnlockOffer({
			...baseReport,
			verdict: 'no-go',
			score: 100,
			summary: { pass: 10, warn: 0, fail: 0 },
			checks: []
		});

		expect(offer?.headline).toContain('guided repair plan');
		expect(offer?.ctaLabel).toBe('Start Solo for verification proof');
		expect(offer?.valuePitch).toContain('verification proof');
	});

	it('sells GO reports with remaining polish as optional guided repair work', () => {
		const offer = buildUnlockOffer({
			...baseReport,
			verdict: 'go',
			score: 92,
			summary: { pass: 10, warn: 2, fail: 0 },
			checks: [check('open-graph', 'warn'), check('twitter-card', 'warn')]
		});

		expect(offer?.headline).toContain('polish guidance');
		expect(offer?.valuePitch).toContain('2 polish items');
		expect(offer?.projectedScore).toBe(100);
	});

	it('sells all-clear reports as recurring verification history', () => {
		const offer = buildUnlockOffer({
			...baseReport,
			verdict: 'go',
			score: 100,
			summary: { pass: 10, warn: 0, fail: 0 },
			checks: []
		});

		expect(offer?.headline).toContain('verification proof');
		expect(offer?.valuePitch).toBe('Verification history with score delta on this project');
	});

	it('previews overflow repair work after the first four issues', () => {
		const offer = buildUnlockOffer({
			...baseReport,
			verdict: 'conditional',
			summary: { pass: 1, warn: 5, fail: 0 },
			checks: [
				check('title', 'warn'),
				check('description', 'warn'),
				check('open-graph', 'warn'),
				check('twitter-card', 'warn'),
				check('sitemap', 'warn')
			]
		});

		expect(offer?.masterPreviewLines.at(-1)).toContain('+1 more issue');
	});

	it('includes guided repair plan line count', () => {
		const offer = buildUnlockOffer({
			...baseReport,
			verdict: 'no-go',
			checks: [check('privacy', 'fail'), check('open-graph', 'fail')]
		});
		expect(offer?.masterPromptLineCount).toBeGreaterThan(5);
	});
});

describe('computeFixProgress', () => {
	it('counts fixed issues and P0 blockers from baseline', () => {
		const baseline = toCheckSnapshots([
			{ ...check('privacy', 'fail'), priority: 'p0', title: 'Privacy policy' },
			{ ...check('title', 'warn'), priority: 'p2', title: 'Page title' },
			{ ...check('og-image', 'pass'), title: 'OG image' }
		]);
		const current: ScanCheck[] = [
			{ ...check('privacy', 'pass'), priority: 'p0', title: 'Privacy policy' },
			{ ...check('title', 'warn'), priority: 'p2', title: 'Page title' },
			{ ...check('meta', 'fail'), title: 'Meta description' }
		];
		const progress = computeFixProgress(baseline, current);
		expect(progress.totalIssues).toBe(2);
		expect(progress.fixedCount).toBe(1);
		expect(progress.fixedBlockerCount).toBe(1);
		expect(progress.fixed).toEqual(['Privacy policy']);
		expect(progress.regressed).toEqual(['Meta description']);
	});

	it('counts P0 warnings as fixed blockers when the catalog marks them critical', () => {
		const baseline = toCheckSnapshots([{ ...check('privacy', 'warn'), title: 'Privacy policy' }]);
		const current: ScanCheck[] = [{ ...check('privacy', 'pass'), title: 'Privacy policy' }];

		const progress = computeFixProgress(baseline, current);

		expect(progress.fixedBlockerCount).toBe(1);
	});
});

describe('baseline check session storage', () => {
	it('round-trips baseline snapshots through sessionStorage', () => {
		const { sessionStorage } = stubSessionStorage();
		const snapshots = toCheckSnapshots([
			{ ...check('privacy', 'fail'), priority: 'p0' },
			{ ...check('title', 'warn'), priority: 'p2' }
		]);

		saveBaselineChecks(snapshots);

		expect(sessionStorage.setItem).toHaveBeenCalledWith(
			STORAGE.baselineChecks,
			JSON.stringify(snapshots)
		);
		expect(loadBaselineChecks()).toEqual(snapshots);
	});

	it('returns null for missing, invalid, or unavailable sessionStorage', () => {
		stubSessionStorage();
		expect(loadBaselineChecks()).toBeNull();

		stubSessionStorage({ [STORAGE.baselineChecks]: '{not-json' });
		expect(loadBaselineChecks()).toBeNull();

		vi.unstubAllGlobals();
		expect(loadBaselineChecks()).toBeNull();
		expect(() => saveBaselineChecks([])).not.toThrow();
	});
});
