import type { ScanCheck } from '$lib/scan/types';

export type CheckPriority = 'p0' | 'p1' | 'p2';
export type LaunchVerdict = 'go' | 'conditional' | 'no-go';

const P0_IDS = new Set([
	'reachable',
	'fetch',
	'https',
	'secrets',
	'privacy',
	'noindex',
	'robots-block',
	'env-committed',
	// Only fails when a form posts over plain HTTP or a password field sits on
	// an http page — unambiguously a launch blocker.
	'form-security'
]);
const P1_IDS = new Set([
	'viewport',
	'open-graph',
	'description',
	'title',
	'mixed-content',
	'links',
	'clarity',
	'twitter-card',
	'page-weight',
	'hsts-header',
	'og-image-live',
	'og-image-type',
	'placeholder-copy',
	'license-risk',
	'repo-license',
	'gitignore-env',
	// Template leftovers ("Vite App" title) are as embarrassing as placeholder copy.
	'default-favicon-title'
]);

const PRIORITY_RANK = { p0: 0, p1: 1, p2: 2 } as const;

export function checkPriority(id: string): CheckPriority {
	if (P0_IDS.has(id)) return 'p0';
	if (P1_IDS.has(id)) return 'p1';
	return 'p2';
}

export function resolvePriority(check: ScanCheck): CheckPriority {
	return check.priority ?? checkPriority(check.id);
}

export function compareChecksByPriority(a: ScanCheck, b: ScanCheck): number {
	const pa = PRIORITY_RANK[resolvePriority(a)];
	const pb = PRIORITY_RANK[resolvePriority(b)];
	if (pa !== pb) return pa - pb;
	if (a.status === 'fail' && b.status !== 'fail') return -1;
	if (b.status === 'fail' && a.status !== 'fail') return 1;
	return 0;
}

/** Non-passing checks sorted for display and prompt generation. */
export function sortChecksByPriority(checks: ScanCheck[]): ScanCheck[] {
	return checks.filter((c) => c.status !== 'pass').sort(compareChecksByPriority);
}

export function tagCheckPriorities(checks: ScanCheck[]): ScanCheck[] {
	return checks.map((check) => ({ ...check, priority: checkPriority(check.id) }));
}

export function computeVerdict(
	checks: ScanCheck[],
	score: number
): { verdict: LaunchVerdict; verdictMessage: string } {
	const failing = checks.filter((c) => c.status === 'fail');
	const p0Fails = failing.filter((c) => resolvePriority(c) === 'p0');
	const p1Fails = failing.filter((c) => resolvePriority(c) === 'p1');
	const p1Warns = checks.filter((c) => c.status === 'warn' && resolvePriority(c) === 'p1');

	if (p0Fails.length > 0) {
		const names = p0Fails
			.map((c) => c.title)
			.slice(0, 3)
			.join(', ');
		return {
			verdict: 'no-go',
			verdictMessage: `Do not share publicly — ${p0Fails.length} blocker(s): ${names}`
		};
	}

	if (p1Fails.length > 0 || score < 60) {
		return {
			verdict: 'conditional',
			verdictMessage: 'Fix important issues before posting on Product Hunt or Reddit.'
		};
	}

	if (p1Warns.length > 0 || score < 80) {
		return {
			verdict: 'conditional',
			verdictMessage: 'Mostly ready — polish remaining issues before a big launch.'
		};
	}

	return {
		verdict: 'go',
		verdictMessage: 'Clear to share your URL publicly.'
	};
}
