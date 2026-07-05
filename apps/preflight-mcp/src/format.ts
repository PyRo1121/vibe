import { reportUrl } from './api.js';
import type { GateResult } from './gate.js';
import type { OutputFormat, ScanCheck, ScanReport } from './types.js';

export interface AgentIssue {
	id: string;
	title: string;
	status: string;
	priority?: string;
	message: string;
	fixPrompt: string | null;
}

export interface AgentScanPayload {
	url: string;
	finalUrl: string;
	score: number;
	verdict: string;
	verdictMessage: string;
	summary: ScanReport['summary'];
	reportId: string | null;
	reportUrl: string | null;
	unlocked: boolean;
	scanCoverage?: string;
	pagesScanned: ScanReport['pagesScanned'];
	embarrassmentRisks: string[];
	launchHeadline: string | null;
	issues: AgentIssue[];
	masterPrompt: string | null;
	samplePromptId: string | null;
	previousScore?: number;
	scoreDelta?: number;
	repo: ScanReport['repo'];
	unlockHint: string | null;
}

export interface AgentGatePayload extends AgentScanPayload {
	pass: boolean;
	advisory: boolean;
	minScore: number;
	reasons: string[];
}

function nonPassingChecks(report: ScanReport, maxIssues: number): ScanCheck[] {
	return report.checks
		.filter((c) => c.status !== 'pass')
		.toSorted((a, b) => priorityRank(a) - priorityRank(b))
		.slice(0, maxIssues);
}

function priorityRank(check: ScanCheck): number {
	const p = check.priority ?? 'p2';
	if (p === 'p0') return 0;
	if (p === 'p1') return 1;
	return 2;
}

function toAgentIssue(check: ScanCheck): AgentIssue {
	return {
		id: check.id,
		title: check.title,
		status: check.status,
		priority: check.priority,
		message: check.message,
		fixPrompt: check.fixPrompt?.trim() ? check.fixPrompt : null
	};
}

function unlockHint(report: ScanReport): string | null {
	if (report.unlocked) return null;
	const hasRedacted = report.checks.some(
		(c) => c.status === 'fail' && !c.fixPrompt?.trim() && c.id !== report.samplePromptId
	);
	if (!hasRedacted) return null;
	return `More fix prompts are available after unlock ($9) at ${reportUrl(report) ?? 'Deploylint'}. Pass unlock_session_id from Stripe checkout to this tool.`;
}

export function buildAgentScanPayload(report: ScanReport, maxIssues = 25): AgentScanPayload {
	const issues = nonPassingChecks(report, maxIssues).map(toAgentIssue);
	return {
		url: report.url,
		finalUrl: report.finalUrl,
		score: report.score,
		verdict: report.verdict,
		verdictMessage: report.verdictMessage,
		summary: report.summary,
		reportId: report.reportId ?? null,
		reportUrl: reportUrl(report),
		unlocked: Boolean(report.unlocked),
		scanCoverage: report.scanCoverage,
		pagesScanned: report.pagesScanned,
		embarrassmentRisks: report.launchBrief?.embarrassmentRisks ?? [],
		launchHeadline: report.launchBrief?.headline ?? null,
		issues,
		masterPrompt: report.masterPrompt?.trim() ? report.masterPrompt : null,
		samplePromptId: report.samplePromptId ?? null,
		previousScore: report.previousScore,
		scoreDelta: report.scoreDelta,
		repo: report.repo,
		unlockHint: unlockHint(report)
	};
}

export function buildAgentGatePayload(
	report: ScanReport,
	gate: GateResult,
	minScore: number,
	advisory: boolean,
	maxIssues = 25
): AgentGatePayload {
	return {
		...buildAgentScanPayload(report, maxIssues),
		pass: advisory ? true : gate.pass,
		advisory,
		minScore,
		reasons: gate.reasons
	};
}

export function formatScanMarkdown(report: ScanReport, maxIssues = 25): string {
	const payload = buildAgentScanPayload(report, maxIssues);
	const lines = [
		`# Deploylint scan`,
		``,
		`- **URL:** ${payload.finalUrl}`,
		`- **Score:** ${payload.score}/100`,
		`- **Verdict:** ${payload.verdict.toUpperCase()}`,
		`- **Summary:** ${payload.summary.pass} pass · ${payload.summary.warn} warn · ${payload.summary.fail} fail`
	];

	if (payload.reportUrl) lines.push(`- **Report:** ${payload.reportUrl}`);
	if (payload.scoreDelta != null && payload.previousScore != null) {
		const sign = payload.scoreDelta >= 0 ? '+' : '';
		lines.push(
			`- **Score delta:** ${payload.previousScore} → ${payload.score} (${sign}${payload.scoreDelta})`
		);
	}
	if (payload.repo) {
		lines.push(`- **Repo:** ${payload.repo.owner}/${payload.repo.repo}@${payload.repo.branch}`);
	}
	if (payload.pagesScanned?.length) {
		lines.push(`- **Pages scanned:** ${payload.pagesScanned.map((p) => p.role).join(', ')}`);
	}

	lines.push('', payload.verdictMessage);

	if (payload.launchHeadline) {
		lines.push('', `## ${payload.launchHeadline}`);
	}
	if (payload.embarrassmentRisks.length > 0) {
		lines.push('', '## Embarrassment radar', '');
		for (const risk of payload.embarrassmentRisks.slice(0, 5)) {
			lines.push(`- ${risk}`);
		}
	}

	if (payload.issues.length > 0) {
		lines.push('', `## Issues (${payload.summary.fail + payload.summary.warn} non-passing)`, '');
		for (const issue of payload.issues) {
			lines.push(
				`### ${issue.title} (${issue.status}${issue.priority ? ` · ${issue.priority}` : ''})`
			);
			lines.push(issue.message);
			if (issue.fixPrompt) {
				lines.push('', '**Fix prompt:**', '```', issue.fixPrompt, '```', '');
			}
		}
	}

	if (payload.masterPrompt) {
		lines.push('', '## Master repair prompt', '', '```', payload.masterPrompt, '```');
	}

	if (payload.unlockHint) {
		lines.push('', `> ${payload.unlockHint}`);
	}

	return lines.join('\n');
}

export function formatGateMarkdown(
	report: ScanReport,
	gate: GateResult,
	minScore: number,
	advisory: boolean,
	maxIssues = 25
): string {
	const payload = buildAgentGatePayload(report, gate, minScore, advisory, maxIssues);
	const header = advisory
		? payload.reasons.length > 0
			? '⚠️ ADVISORY — issues found (not blocking)'
			: '✅ ADVISORY — clear to ship'
		: gate.pass
			? '✅ PASS — clear to ship'
			: '❌ FAIL — fix before posting publicly';

	const lines = [header, '', formatScanMarkdown(report, maxIssues)];

	if (payload.reasons.length > 0) {
		lines.push('', '## Gate failures', '');
		for (const reason of payload.reasons) lines.push(`- ${reason}`);
		if (advisory) {
			lines.push('', '_Advisory mode — build would not be blocked._');
		}
	}

	return lines.join('\n');
}

export function encodeOutput(format: OutputFormat, payload: unknown): string {
	if (format === 'json') return JSON.stringify(payload, null, 2);
	throw new Error('encodeOutput called without markdown handler');
}
