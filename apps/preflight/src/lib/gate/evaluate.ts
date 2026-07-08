import type { ScanReport } from '$lib/scan/types';
import { checkPriority, type LaunchVerdict } from '$lib/scan/verdict';

export interface GateOptions {
	minScore?: number;
	failOnP0?: boolean;
	blockVerdicts?: LaunchVerdict[];
}

export interface GateResult {
	pass: boolean;
	reasons: string[];
	report: Pick<ScanReport, 'score' | 'verdict' | 'verdictMessage' | 'finalUrl' | 'checks'>;
}

interface FormatGateReportOptions {
	advisory?: boolean;
}

export function evaluateGate(report: ScanReport, opts: GateOptions = {}): GateResult {
	const minScore = opts.minScore ?? 80;
	const failOnP0 = opts.failOnP0 ?? true;
	const blockVerdicts = opts.blockVerdicts ?? ['no-go'];
	const reasons: string[] = [];

	if (blockVerdicts.includes(report.verdict)) {
		reasons.push(`Verdict ${report.verdict.toUpperCase()}: ${report.verdictMessage}`);
	}

	if (report.score < minScore) {
		reasons.push(`Score ${report.score} is below minimum ${minScore}`);
	}

	if (failOnP0) {
		for (const check of report.checks) {
			if (check.status !== 'fail' || checkPriority(check.id) !== 'p0') continue;
			reasons.push(`P0 blocker: ${check.title} — ${check.message}`);
		}
	}

	return {
		pass: reasons.length === 0,
		reasons,
		report: {
			score: report.score,
			verdict: report.verdict,
			verdictMessage: report.verdictMessage,
			finalUrl: report.finalUrl,
			checks: report.checks
		}
	};
}

export function formatGateReport(result: GateResult, opts: FormatGateReportOptions = {}): string {
	const { report } = result;
	const advisory = opts.advisory === true;
	const status = advisory && !result.pass ? 'ADVISORY' : result.pass ? 'PASS' : 'FAIL';
	const reasonHeading = advisory ? 'Advisory findings:' : 'Failures:';
	const lines = [
		`Deploylint ${advisory ? 'advisory' : 'gate'}: ${status}`,
		`URL: ${report.finalUrl}`,
		`Score: ${report.score} · Verdict: ${report.verdict.toUpperCase()}`,
		report.verdictMessage
	];

	if (result.reasons.length > 0) {
		lines.push('', reasonHeading);
		for (const reason of result.reasons) lines.push(`- ${reason}`);
		if (advisory) lines.push('', 'Advisory mode - not blocking the build.');
	}

	return lines.join('\n');
}
