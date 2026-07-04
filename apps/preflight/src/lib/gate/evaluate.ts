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

export function formatGateReport(result: GateResult): string {
	const { report } = result;
	const lines = [
		`Deploylint gate: ${result.pass ? 'PASS' : 'FAIL'}`,
		`URL: ${report.finalUrl}`,
		`Score: ${report.score} · Verdict: ${report.verdict.toUpperCase()}`,
		report.verdictMessage
	];

	if (result.reasons.length > 0) {
		lines.push('', 'Failures:');
		for (const reason of result.reasons) lines.push(`- ${reason}`);
	}

	return lines.join('\n');
}
