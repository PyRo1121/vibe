/** Sync with apps/preflight/src/lib/scan/verdict.ts P0_IDS */
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

export interface GateScanReport {
	score: number;
	verdict: string;
	verdictMessage: string;
	finalUrl: string;
	checks: { id: string; title: string; status: string; message: string; priority?: string }[];
	summary: { pass: number; warn: number; fail: number };
}

export function evaluateGate(report: GateScanReport, minScore: number): { pass: boolean; reasons: string[] } {
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
