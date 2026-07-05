import type { ScanReport } from './types.js';

/** Sync with apps/preflight/src/lib/scan/p0-ids.ts P0_CHECK_IDS */
export const GATE_P0_IDS = new Set([
	'reachable',
	'fetch',
	'https',
	'secrets',
	'privacy',
	'noindex',
	'robots-block',
	'form-security',
	'env-committed',
	'exposed-env',
	'exposed-git'
]);

export type GateScanReport = Pick<
	ScanReport,
	'score' | 'verdict' | 'verdictMessage' | 'finalUrl' | 'checks' | 'summary'
>;

export interface GateResult {
	pass: boolean;
	reasons: string[];
}

export function evaluateGate(report: GateScanReport, minScore: number): GateResult {
	const reasons: string[] = [];

	if (report.verdict === 'no-go') {
		reasons.push(`NO-GO: ${report.verdictMessage}`);
	}
	if (report.score < minScore) {
		reasons.push(`Score ${report.score} below minimum ${minScore}`);
	}
	for (const check of report.checks) {
		if (check.status === 'fail' && GATE_P0_IDS.has(check.id)) {
			reasons.push(`P0: ${check.title} — ${check.message}`);
		}
	}
	return { pass: reasons.length === 0, reasons };
}
