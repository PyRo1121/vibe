import { json, error } from '@sveltejs/kit';
import { createScanDeps } from '$lib/scan/fetchers';
import { scanUrl } from '$lib/scan/engine';
import { parseRepoUrl } from '$lib/scan/repo/parse';
import { scanRepo } from '$lib/scan/repo/scan';
import { parseScanJsonBody, rejectValidation } from '$lib/server/api';
import { appendHistory, computeScanDiff, issueMap, saveReport } from '$lib/server/report-store';
import { buildCopyReview } from '$lib/server/copy-review';
import { sanitizeReport } from '$lib/billing/report';
import { verifyCheckoutSession } from '$lib/billing/stripe';
import { logFunnelEvent } from '$lib/metrics/funnel';
import { assertScanRateLimit, clientIp } from '$lib/server/rate-limit';

export async function handleScanPost(request: Request, env: Env | undefined) {
	await assertScanRateLimit(env?.REPORTS, clientIp(request));

	let parsed;
	try {
		parsed = await parseScanJsonBody(request);
	} catch (err) {
		rejectValidation(err);
	}

	const repoRef = parseRepoUrl(parsed.url);
	const deps = createScanDeps(env);
	const report = repoRef
		? await scanRepo(repoRef, { token: env?.GITHUB_TOKEN })
		: await scanUrl(parsed.url, deps);
	const stripeKey = env?.STRIPE_SECRET_KEY;

	if (parsed.unlockSessionId && !stripeKey) {
		error(503, 'Unlock verification is not configured yet');
	}

	let unlocked = false;
	if (parsed.unlockSessionId && stripeKey) {
		unlocked = await verifyCheckoutSession(parsed.unlockSessionId, parsed.url, stripeKey);
	}

	const sanitized = sanitizeReport(report, unlocked, {
		previousScore: unlocked ? parsed.previousScore : undefined
	});

	// Store the free (prompt-stripped) version so share links never leak paid prompts.
	if (env?.REPORTS) {
		const stored = unlocked ? sanitizeReport(report, false) : sanitized;
		const reportId = await saveReport(env.REPORTS, stored);
		if (reportId) {
			sanitized.reportId = reportId;
			const previous = await appendHistory(env.REPORTS, report.finalUrl, {
				id: reportId,
				score: report.score,
				verdict: report.verdict,
				at: report.scannedAt,
				issues: issueMap(report.checks)
			});
			if (previous.length > 0) {
				sanitized.history = previous
					.slice(-5)
					.map(({ id, score, verdict, at }) => ({ id, score, verdict, at }));
				const lastIssues = previous[previous.length - 1]?.issues;
				if (lastIssues) sanitized.scanDiff = computeScanDiff(lastIssues, report.checks);
			}
		}
	}

	// Paid extra: AI copy critique. Unlocked-only keeps Workers AI usage
	// far inside the free daily allocation.
	if (unlocked && env?.AI && !repoRef && report.scanCoverage !== 'blocked') {
		const review = await buildCopyReview(env.AI, {
			url: report.finalUrl,
			title: report.socialPreview?.title ?? null,
			description: report.socialPreview?.description ?? null,
			topIssues: report.checks
				.filter((c) => c.status !== 'pass')
				.slice(0, 5)
				.map((c) => `${c.title}: ${c.message}`)
		});
		if (review) sanitized.aiCopyReview = review;
	}

	const issueCount = sanitized.checks.filter((c) => c.status !== 'pass').length;
	const isRescan = unlocked && parsed.previousScore != null;

	logFunnelEvent(isRescan ? 'rescan_completed' : 'scan_completed', {
		verdict: sanitized.verdict,
		score: sanitized.score,
		issueCount,
		unlocked,
		...(sanitized.scoreDelta != null ? { scoreDelta: sanitized.scoreDelta } : {})
	});

	return json(sanitized);
}
