import { sanitizeReport } from '$lib/billing/report';
import { logFunnelEvent } from '$lib/metrics/funnel';
import { resolveAlphaFreeUnlock } from '$lib/product/alpha';
import { scanUrl } from '$lib/scan/engine';
import { createScanDeps } from '$lib/scan/fetchers';
import { parseRepoUrl } from '$lib/scan/repo/parse';
import { scanRepo } from '$lib/scan/repo/scan';
import { parseScanJsonBody, rejectValidation } from '$lib/server/api';
import { buildCopyReview } from '$lib/server/copy-review';
import { recordProjectReport } from '$lib/server/project-reports';
import { assertScanRateLimit, clientIp } from '$lib/server/rate-limit';
import { appendHistory, computeScanDiff, issueMap, saveReport } from '$lib/server/report-store';
import { resolveUnlock } from '$lib/server/resolve-unlock';
import { assertDailyScanBudget, reserveAiCopyReview } from '$lib/server/usage-budget';
import { json, error } from '@sveltejs/kit';

export async function handleScanPost(request: Request, env?: Env) {
	let parsed;
	try {
		parsed = await parseScanJsonBody(request);
	} catch (err) {
		rejectValidation(err);
	}

	await assertDailyScanBudget(env?.REPORTS, env?.LIMITER);
	await assertScanRateLimit(env?.REPORTS, clientIp(request), env?.LIMITER);

	const repoRef = parseRepoUrl(parsed.url);
	const alphaFreeUnlock = resolveAlphaFreeUnlock(env);
	const deps = createScanDeps(env);
	const report = repoRef
		? await scanRepo(repoRef, { token: env?.GITHUB_TOKEN })
		: await scanUrl(parsed.url, deps);
	const stripeKey = env?.STRIPE_SECRET_KEY;

	if (!alphaFreeUnlock && parsed.unlockSessionId && !stripeKey && !env?.REPORTS) {
		error(503, 'Unlock verification is not configured yet');
	}

	let unlocked = alphaFreeUnlock;
	if (!alphaFreeUnlock && parsed.unlockSessionId) {
		unlocked ||= await resolveUnlock({
			kv: env?.REPORTS,
			stripeKey,
			scanUrl: parsed.url,
			sessionId: parsed.unlockSessionId
		});
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
				const lastIssues = previous.at(-1)?.issues;
				if (lastIssues) sanitized.scanDiff = computeScanDiff(lastIssues, report.checks);
			}
		}
	}

	await recordProjectReport(
		env?.AUTH_DB,
		{
			projectId: parsed.projectId,
			ingestToken: parsed.ingestToken,
			commitSha: parsed.commitSha,
			branch: parsed.branch,
			pullRequest: parsed.pullRequest
		},
		sanitized
	);

	// Paid extra: AI copy critique. Unlocked-only + daily cap keeps Workers AI inside
	// the free 10k neurons/day allocation.
	if (unlocked && env?.AI && !repoRef && report.scanCoverage !== 'blocked') {
		const allowed = await reserveAiCopyReview(env.REPORTS, env.LIMITER);
		if (allowed) {
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
	}

	const issueCount = sanitized.checks.filter((c) => c.status !== 'pass').length;
	const isRescan = unlocked && parsed.previousScore != null;

	logFunnelEvent(isRescan ? 'rescan_completed' : 'scan_completed', {
		verdict: sanitized.verdict,
		score: sanitized.score,
		issueCount,
		unlocked,
		mode: alphaFreeUnlock ? 'alpha' : 'paid',
		...(sanitized.scoreDelta == null ? {} : { scoreDelta: sanitized.scoreDelta })
	});

	return json(sanitized);
}
