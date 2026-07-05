import { buildMasterPrompt, pickSamplePromptCheck } from '$lib/scan/prompts';
import type { ScanCheck, ScanReport } from '$lib/scan/types';

export interface SanitizeOptions {
	previousScore?: number;
}

function clampScore(value: number): number {
	return Math.max(0, Math.min(100, Math.round(value)));
}

/** Strip fix prompts unless unlocked. Builds master prompt and optional re-scan delta when unlocked. */
export function sanitizeReport(
	report: ScanReport,
	unlocked: boolean,
	opts: SanitizeOptions = {}
): ScanReport {
	if (unlocked) {
		const out: ScanReport = {
			...report,
			unlocked: true,
			masterPrompt: buildMasterPrompt(report.checks, report.finalUrl, {
				scanCoverage: report.scanCoverage,
				httpStatus: parseHttpStatus(report)
			})
		};

		if (opts.previousScore != null) {
			const baseline = clampScore(opts.previousScore);
			out.previousScore = baseline;
			out.scoreDelta = report.score - baseline;
		}

		return out;
	}

	const sample = pickSamplePromptCheck(report.checks, { scanCoverage: report.scanCoverage });

	return {
		...report,
		unlocked: false,
		masterPrompt: '',
		samplePromptId: sample?.id,
		checks: report.checks.map((check) => redactPrompt(check, sample?.id))
	};
}

function redactPrompt(check: ScanCheck, sampleId?: string): ScanCheck {
	if (check.status === 'pass' || !check.fixPrompt) {
		return { ...check, fixPrompt: '' };
	}
	if (sampleId && check.id === sampleId) {
		return check;
	}
	return { ...check, fixPrompt: '' };
}

function parseHttpStatus(report: ScanReport): number | undefined {
	const reachable = report.checks.find((c) => c.id === 'reachable' || c.id === 'fetch');
	const match = reachable?.message.match(/\bHTTP (\d{3})\b/);
	return match ? Number(match[1]) : undefined;
}
