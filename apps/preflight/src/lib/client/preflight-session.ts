import { buildMasterPrompt } from '$lib/scan/prompts';
import { scoreChecks } from '$lib/scan/score';
import type { CheckStatus, ScanCheck, ScanReport } from '$lib/scan/types';
import type { CheckPriority } from '$lib/scan/verdict';
import { checkPriority, resolvePriority, sortChecksByPriority } from '$lib/scan/verdict';

export const STORAGE = {
	scanUrl: 'preflight_scan_url',
	unlockSession: 'preflight_unlock_session',
	baselineScore: 'preflight_baseline_score',
	baselineChecks: 'preflight_baseline_checks'
} as const;

export type CheckSnapshot = {
	id: string;
	status: CheckStatus;
	priority?: CheckPriority;
};

export interface FixProgress {
	totalIssues: number;
	fixedCount: number;
	fixedBlockerCount: number;
	fixed: string[];
	regressed: string[];
}

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
	/** Full guided repair plan line count — shown pre-unlock as social proof */
	masterPromptLineCount: number;
}

export function toCheckSnapshots(checks: ScanCheck[]): CheckSnapshot[] {
	return checks.map((c) => ({
		id: c.id,
		status: c.status,
		priority: c.priority
	}));
}

export function saveBaselineChecks(snapshots: CheckSnapshot[]): void {
	if (typeof sessionStorage === 'undefined') return;
	sessionStorage.setItem(STORAGE.baselineChecks, JSON.stringify(snapshots));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCheckStatus(value: unknown): value is CheckStatus {
	return value === 'pass' || value === 'warn' || value === 'fail';
}

function isCheckPriority(value: unknown): value is CheckPriority {
	return value === 'p0' || value === 'p1' || value === 'p2';
}

function readCheckSnapshot(value: unknown): CheckSnapshot | null {
	if (!isRecord(value) || typeof value.id !== 'string' || !isCheckStatus(value.status)) {
		return null;
	}

	return {
		id: value.id,
		status: value.status,
		...(isCheckPriority(value.priority) ? { priority: value.priority } : {})
	};
}

function isPresent<T>(value: T | null): value is T {
	return value !== null;
}

export function loadBaselineChecks(): CheckSnapshot[] | null {
	if (typeof sessionStorage === 'undefined') return null;
	const raw = sessionStorage.getItem(STORAGE.baselineChecks);
	if (!raw) return null;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return null;
		return parsed.map(readCheckSnapshot).filter(isPresent);
	} catch {
		return null;
	}
}

function wasBlocker(snapshot: CheckSnapshot): boolean {
	const priority = snapshot.priority ?? checkPriority(snapshot.id);
	if (snapshot.status === 'fail' && priority === 'p0') return true;
	return snapshot.status === 'warn' && priority === 'p0';
}

/** Check-level delta vs sessionStorage baseline from the first scan of this URL. */
export function computeFixProgress(baseline: CheckSnapshot[], current: ScanCheck[]): FixProgress {
	const prevIssues = new Map<string, CheckSnapshot>();
	for (const snapshot of baseline) {
		if (snapshot.status === 'fail' || snapshot.status === 'warn') {
			prevIssues.set(snapshot.id, snapshot);
		}
	}

	const fixed: string[] = [];
	const regressed: string[] = [];
	let fixedBlockerCount = 0;

	for (const check of current) {
		const was = prevIssues.get(check.id);
		const isIssue = check.status === 'fail' || check.status === 'warn';
		if (was && !isIssue) {
			fixed.push(check.title);
			if (wasBlocker(was)) fixedBlockerCount++;
		}
		if (!was && isIssue) regressed.push(check.title);
	}

	return {
		totalIssues: prevIssues.size,
		fixedCount: fixed.length,
		fixedBlockerCount,
		fixed,
		regressed
	};
}

function estimateMasterPromptLineCount(report: ScanReport): number {
	const text = buildMasterPrompt(report.checks, report.finalUrl, {
		scanCoverage: report.scanCoverage
	});
	return text.split('\n').length;
}

/** Optimistic score if user fixes fails and P1 warns — for re-scan preview only. */
function estimateScoreAfterFixes(report: ScanReport): number | null {
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

function buildMasterPromptPreview(report: ScanReport): string[] {
	if (report.scanCoverage === 'blocked') {
		return [
			`Site: ${report.finalUrl}`,
			'',
			'Deploylint could not read your homepage - content checks skipped.',
			'',
			'Do NOT fix SEO/meta from this review. Fix reachability or bot access, then verify again.'
		];
	}

	const issues = sortChecksByPriority(report.checks.filter((c) => c.status !== 'pass')).slice(0, 4);
	const header = `You are fixing deploy readiness for ${report.finalUrl}.`;
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
		lines.push(`… +${remaining} more issue${remaining === 1 ? '' : 's'} with guided fixes`);
	return [header, '', intro, ...lines];
}

export function buildUnlockOffer(report: ScanReport): UnlockOffer | null {
	if (report.unlocked) return null;

	if (report.scanCoverage === 'blocked') {
		return null;
	}

	const issues = report.checks.filter((c) => c.status !== 'pass');
	const lockedPromptCount = Math.max(0, issues.length - (report.samplePromptId ? 1 : 0));
	const blockerCount = issues.filter(
		(c) => c.status === 'fail' && resolvePriority(c) === 'p0'
	).length;
	const projectedScore = estimateScoreAfterFixes(report);
	const masterPreviewLines = buildMasterPromptPreview(report);
	const masterPromptLineCount = estimateMasterPromptLineCount(report);

	let headline: string;
	let subhead: string;
	let valuePitch: string;
	let ctaLabel: string;

	const promptPart =
		lockedPromptCount > 0
			? `${lockedPromptCount} guided fix${lockedPromptCount === 1 ? '' : 'es'}`
			: 'verification proof';
	const deltaPart =
		projectedScore == null ? '' : ` · verification could show ${report.score} → ${projectedScore}`;

	if (report.verdict === 'no-go') {
		headline =
			blockerCount > 0
				? `Gate not ready - ${blockerCount} deploy blocker${blockerCount === 1 ? '' : 's'} need fixes`
				: 'Gate not ready - use the guided repair plan before production';
		subhead =
			'Solo turns the report into a repair loop: apply the plan, deploy, and verify again before this reaches production.';
		valuePitch = `Unlock ${promptPart} + guided repair plan${deltaPart}`;
		ctaLabel = lockedPromptCount > 0 ? 'Start Solo - $9/mo' : 'Start Solo for verification proof';
	} else if (report.verdict === 'conditional') {
		headline = 'Almost gate-ready - fix the remaining deploy risks';
		subhead =
			'One free sample is not enough for a production gate. Start Solo, apply the guided plan, and verify until verdict is GO.';
		valuePitch = `Unlock ${promptPart} + guided repair plan${deltaPart}`;
		ctaLabel = 'Start Solo - $9/mo';
	} else if (lockedPromptCount > 0) {
		headline = 'Verdict is GO — unlock polish guidance + proof';
		subhead =
			'Optional warnings remain. Start Solo if you want every guided fix and a before/after score on verification.';
		valuePitch = `${lockedPromptCount} polish item${lockedPromptCount === 1 ? '' : 's'} + guided repair plan${deltaPart}`;
		ctaLabel = 'Start Solo - $9/mo';
	} else {
		headline = 'Unlock verification proof for this deploy target';
		subhead =
			'Everything passed. Start Solo for recurring monitoring and verification after last-minute edits.';
		valuePitch = 'Verification history with score delta on this project';
		ctaLabel = 'Start Solo - $9/mo';
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
		masterPreviewLines,
		masterPromptLineCount
	};
}

export function buildShareText(report: ScanReport, appUrl: string): string {
	const verdict =
		report.verdict === 'go' ? 'GO' : report.verdict === 'conditional' ? 'CONDITIONAL GO' : 'NO-GO';
	const base = appUrl.replace(/\/$/, '');
	const risk = report.launchBrief?.embarrassmentRisks?.[0];
	const hook = risk
		? `Deploylint caught this before this reaches production:\n"${risk.slice(0, 140)}${risk.length > 140 ? '...' : ''}"`
		: `Deploylint produced CI/deploy readiness evidence for this project - ${report.score}/100 (${verdict}).`;
	const permalink = report.reportId ? `${base}/r/${report.reportId}` : null;
	const lines = [
		hook,
		`Readiness score: ${report.score}/100 (${verdict}) - ${report.finalUrl}`,
		...(permalink ? [`Readiness brief: ${permalink}`] : []),
		`Add Deploylint to CI: ${base}/developers`
	];
	return lines.join('\n');
}
