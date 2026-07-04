import type { ScanReport } from '$lib/scan/types';
import { resolvePriority, sortChecksByPriority } from '$lib/scan/verdict';
import { scoreChecks } from '$lib/scan/score';

export const STORAGE = {
	scanUrl: 'preflight_scan_url',
	unlockSession: 'preflight_unlock_session',
	baselineScore: 'preflight_baseline_score'
} as const;

export interface UnlockOffer {
	issueCount: number;
	lockedPromptCount: number;
	blockerCount: number;
	hasSample: boolean;
	headline: string;
	subhead: string;
	/** One-line concrete pay reason shown on unlock UI */
	valuePitch: string;
	ctaLabel: string;
	projectedScore: number | null;
	masterPreviewLines: string[];
}

/** Optimistic score if user fixes fails and P1 warns — for re-scan preview only. */
export function estimateScoreAfterFixes(report: ScanReport): number | null {
	if (report.summary.fail === 0 && report.summary.warn === 0) return null;
	const optimistic = report.checks.map((c) => {
		if (c.status === 'fail') return { ...c, status: 'pass' as const };
		if (c.status === 'warn' && resolvePriority(c) !== 'p2')
			return { ...c, status: 'pass' as const };
		return c;
	});
	const projected = scoreChecks(optimistic);
	return projected > report.score ? projected : null;
}

export function buildMasterPromptPreview(report: ScanReport): string[] {
	if (report.scanCoverage === 'blocked') {
		return [
			`Site: ${report.finalUrl}`,
			'',
			'Preflight could not read your homepage — content checks skipped.',
			'',
			'Do NOT fix SEO/meta from this scan. Fix reachability or bot access, then re-scan.'
		];
	}

	const issues = sortChecksByPriority(report.checks.filter((c) => c.status !== 'pass')).slice(0, 4);
	const header = `You are fixing launch readiness for ${report.finalUrl}.`;
	const intro = 'Fix these issues in order (P0 blockers first):';
	const lines = issues.map(
		(c) =>
			`- [${(c.priority ?? 'p2').toUpperCase()}] ${c.title} (${c.status}): ${c.message.slice(0, 72)}`
	);
	const remaining = Math.max(
		0,
		report.checks.filter((c) => c.status !== 'pass').length - lines.length
	);
	if (remaining > 0)
		lines.push(`… +${remaining} more issue${remaining === 1 ? '' : 's'} with copy-paste prompts`);
	return [header, '', intro, ...lines];
}

export function buildUnlockOffer(report: ScanReport): UnlockOffer | null {
	if (report.unlocked) return null;

	if (report.scanCoverage === 'blocked') {
		const reachable = report.checks.find((c) => c.id === 'reachable' || c.id === 'fetch');
		return {
			issueCount: reachable ? 1 : 0,
			lockedPromptCount: 0,
			blockerCount: 1,
			hasSample: Boolean(report.samplePromptId),
			headline: 'Scan blocked — fix access before buying fix prompts',
			subhead:
				'We only saw an error page. Unlock gives reachability guidance, not SEO fixes. Re-scan after your homepage returns HTTP 200 to us.',
			valuePitch: 'Full audit unlock after a successful scan — not for bot-blocked error pages',
			ctaLabel: 'Unlock reachability guide — $9',
			projectedScore: null,
			masterPreviewLines: buildMasterPromptPreview(report)
		};
	}

	const issues = report.checks.filter((c) => c.status !== 'pass');
	const lockedPromptCount = Math.max(0, issues.length - (report.samplePromptId ? 1 : 0));
	const blockerCount = issues.filter(
		(c) => c.status === 'fail' && resolvePriority(c) === 'p0'
	).length;
	const projectedScore = estimateScoreAfterFixes(report);
	const masterPreviewLines = buildMasterPromptPreview(report);

	let headline: string;
	let subhead: string;
	let valuePitch: string;
	let ctaLabel: string;

	const promptPart =
		lockedPromptCount > 0
			? `${lockedPromptCount} Cursor prompt${lockedPromptCount === 1 ? '' : 's'}`
			: 're-scan proof';
	const deltaPart =
		projectedScore != null ? ` · re-scan could show ${report.score} → ${projectedScore}` : '';

	if (report.verdict === 'no-go') {
		headline =
			blockerCount > 0
				? `Don't post yet — ${blockerCount} launch blocker${blockerCount === 1 ? '' : 's'} need fixes`
				: "Don't post yet — unlock Cursor-ready fixes before you share";
		subhead =
			'Free scan told you what is wrong. Paid unlock is the fix loop: paste prompts into Cursor, deploy, re-scan to prove it.';
		valuePitch = `Unlock ${promptPart} + 1 master paste${deltaPart}`;
		ctaLabel = lockedPromptCount > 0 ? `Fix & verify — $9` : 'Unlock re-scan proof — $9';
	} else if (report.verdict === 'conditional') {
		headline = 'Almost shareable — fix the rest before Product Hunt or Reddit';
		subhead =
			'One free sample prompt is not enough for a public launch. Unlock everything, paste once, re-scan until verdict is GO.';
		valuePitch = `Unlock ${promptPart} + master paste${deltaPart}`;
		ctaLabel = 'Unlock all fixes — $9';
	} else if (lockedPromptCount > 0) {
		headline = 'Verdict is GO — unlock polish prompts + proof';
		subhead =
			'Optional warnings remain. Unlock if you want every fix prompt and a before/after score on re-scan.';
		valuePitch = `${lockedPromptCount} polish prompts + master paste${deltaPart}`;
		ctaLabel = 'Unlock polish & proof — $9';
	} else {
		headline = 'Unlock re-scan proof for your launch post';
		subhead = 'Everything passed. Unlock unlimited re-scans on this URL after last-minute edits.';
		valuePitch = 'Unlimited re-scans with score delta on this URL';
		ctaLabel = 'Unlock re-scans — $9';
	}

	return {
		issueCount: issues.length,
		lockedPromptCount,
		blockerCount,
		hasSample: Boolean(report.samplePromptId),
		headline,
		subhead,
		valuePitch,
		ctaLabel,
		projectedScore,
		masterPreviewLines
	};
}

export function buildShareText(report: ScanReport, appUrl: string): string {
	const verdict =
		report.verdict === 'go' ? 'GO' : report.verdict === 'conditional' ? 'CONDITIONAL GO' : 'NO-GO';

	return `I ran Preflight before posting my URL — ${report.score}/100 (${verdict}).\nCheck yours before you share publicly: ${appUrl.replace(/\/$/, '')}\n${report.finalUrl}`;
}

export function clearCheckoutQuery(): void {
	window.history.replaceState({}, '', window.location.pathname);
}
