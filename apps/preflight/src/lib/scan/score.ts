import type {
	LicenseAudit,
	RepoInfo,
	ScanCheck,
	ScanCoverage,
	ScanReport,
	ScannedPage
} from '$lib/scan/types';
import { blockedScanMessage } from '$lib/scan/coverage';
import { SEO_LIMITS } from '$lib/scan/constants';
import { buildSocialPreview, applyOgImageReachability } from '$lib/scan/social';
import { buildLaunchBrief } from '$lib/scan/brief';
import { computeVerdict, tagCheckPriorities } from '$lib/scan/verdict';

export function clarityScore(
	title: string | null,
	description: string | null,
	h1: boolean
): ScanCheck['status'] {
	let points = 0;
	if (title && title.length >= SEO_LIMITS.clarityTitleMin && title.length <= SEO_LIMITS.titlePass)
		points += 1;
	if (
		description &&
		description.length >= SEO_LIMITS.clarityDescriptionMin &&
		description.length <= SEO_LIMITS.descriptionPass
	)
		points += 1;
	if (h1) points += 1;
	if (points >= 3) return 'pass';
	if (points >= 1) return 'warn';
	return 'fail';
}

export function scoreChecks(checks: ScanCheck[]): number {
	if (checks.length === 0) return 0;
	const weights = { pass: 1, warn: 0.5, fail: 0 };
	const total = checks.reduce((sum, c) => sum + weights[c.status], 0);
	let score = Math.round((total / checks.length) * 100);

	const unreachable = checks.find((c) => c.id === 'fetch' || c.id === 'reachable');
	if (unreachable?.status === 'fail') {
		score = Math.min(score, 25);
	}

	return score;
}

export function makeCheck(
	id: string,
	category: ScanCheck['category'],
	title: string,
	status: ScanCheck['status'],
	message: string,
	fixPrompt: string
): ScanCheck {
	return { id, category, title, status, message, fixPrompt };
}

export function buildReport(
	url: string,
	finalUrl: URL,
	checks: ScanCheck[],
	html?: string,
	opts?: {
		ogImageOk?: boolean | null;
		ogImageProbe?: { contentType: string | null } | null;
		scanCoverage?: ScanCoverage;
		httpStatus?: number;
		licenseAudit?: LicenseAudit;
		pagesScanned?: ScannedPage[];
		repo?: RepoInfo;
		stack?: string[];
		/** Overrides the homepage-specific blocked message (e.g. repo scans). */
		blockedMessage?: string;
	}
): ScanReport {
	const tagged = tagCheckPriorities(checks);
	const summary = {
		pass: tagged.filter((c) => c.status === 'pass').length,
		warn: tagged.filter((c) => c.status === 'warn').length,
		fail: tagged.filter((c) => c.status === 'fail').length
	};
	const score = scoreChecks(tagged);
	let { verdict, verdictMessage } = computeVerdict(tagged, score);

	const blocked = opts?.scanCoverage === 'blocked';
	const blockedMessage = opts?.blockedMessage ?? blockedScanMessage(opts?.httpStatus);
	if (blocked) {
		verdict = 'no-go';
		verdictMessage = blockedMessage;
	}

	const report: ScanReport = {
		url,
		finalUrl: finalUrl.href,
		scannedAt: new Date().toISOString(),
		score,
		verdict,
		verdictMessage,
		checks: tagged,
		summary,
		scanCoverage: blocked ? 'blocked' : 'full',
		...(blocked ? { scanCoverageMessage: blockedMessage } : {}),
		...(opts?.licenseAudit ? { licenseAudit: opts.licenseAudit } : {}),
		...(opts?.pagesScanned ? { pagesScanned: opts.pagesScanned } : {}),
		...(opts?.repo ? { repo: opts.repo } : {}),
		...(opts?.stack?.length ? { stack: opts.stack } : {})
	};

	if (html) {
		let preview = buildSocialPreview(html, finalUrl);
		if (opts?.ogImageOk !== undefined) {
			preview = applyOgImageReachability(preview, opts.ogImageOk, opts.ogImageProbe?.contentType);
		}
		report.socialPreview = preview;
	}

	report.launchBrief = buildLaunchBrief(report);

	return report;
}
