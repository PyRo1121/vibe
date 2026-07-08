import { sanitizeReport } from '$lib/billing/report';
import { logFunnelEvent } from '$lib/metrics/funnel';
import { resolveAlphaFreeUnlock } from '$lib/product/alpha';
import { buildLaunchBrief } from '$lib/scan/brief';
import { scanUrl } from '$lib/scan/engine';
import { createScanDeps } from '$lib/scan/fetchers';
import { buildPaymentReadinessSummary } from '$lib/scan/payment-readiness';
import { parseRepoUrl } from '$lib/scan/repo/parse';
import { scanRepo } from '$lib/scan/repo/scan';
import { scoreChecks } from '$lib/scan/score';
import type { ScanCheck, ScanReport } from '$lib/scan/types';
import { computeVerdict, resolvePriority } from '$lib/scan/verdict';
import { parseScanJsonBody, rejectValidation } from '$lib/server/api';
import { buildCopyReview } from '$lib/server/copy-review';
import { recordProjectReport } from '$lib/server/project-reports';
import { assertScanRateLimit, clientIp } from '$lib/server/rate-limit';
import { appendHistory, computeScanDiff, issueMap, saveReport } from '$lib/server/report-store';
import { resolveUnlock } from '$lib/server/resolve-unlock';
import { assertDailyScanBudget, reserveAiCopyReview } from '$lib/server/usage-budget';
import { json, error, isHttpError } from '@sveltejs/kit';

type TelemetryTargetType = 'deploy_url' | 'github_repo' | 'deploy_and_repo';

function telemetryMode(alphaFreeUnlock: boolean): 'free' | 'paid' {
	return alphaFreeUnlock ? 'free' : 'paid';
}

function telemetryTargetType(repoRef: unknown, attachedRepoRef: unknown): TelemetryTargetType {
	if (repoRef) return 'github_repo';
	if (attachedRepoRef) return 'deploy_and_repo';
	return 'deploy_url';
}

function scoreBucket(score: number): '0-49' | '50-79' | '80-100' {
	if (score < 50) return '0-49';
	if (score < 80) return '50-79';
	return '80-100';
}

function isDailyCapacityError(err: unknown): boolean {
	return (
		isHttpError(err) &&
		err.status === 503 &&
		/(daily scan capacity reached|advisory preview capacity reached)/i.test(err.body.message)
	);
}

function repoEvidenceCheck(check: ScanCheck): ScanCheck {
	return {
		...check,
		id: `repo:${check.id}`,
		title: check.title.startsWith('Repo: ') ? check.title : `Repo: ${check.title}`,
		priority: check.priority ?? resolvePriority(check)
	};
}

function mergeDeployAndRepoReports(deployReport: ScanReport, repoReport: ScanReport): ScanReport {
	const checks = [...deployReport.checks, ...repoReport.checks.map(repoEvidenceCheck)];
	const summary = {
		pass: checks.filter((c) => c.status === 'pass').length,
		warn: checks.filter((c) => c.status === 'warn').length,
		fail: checks.filter((c) => c.status === 'fail').length
	};
	const score = scoreChecks(checks);
	const { verdict, verdictMessage } = computeVerdict(checks, score);
	const merged: ScanReport = {
		...deployReport,
		score,
		verdict,
		verdictMessage,
		checks,
		summary,
		paymentReadiness: buildPaymentReadinessSummary(checks),
		...(repoReport.licenseAudit ? { licenseAudit: repoReport.licenseAudit } : {}),
		...(repoReport.repo ? { repo: repoReport.repo } : {})
	};
	return { ...merged, launchBrief: buildLaunchBrief(merged) };
}

export async function handleScanPost(request: Request, env?: Env) {
	let parsed;
	try {
		parsed = await parseScanJsonBody(request);
	} catch (err) {
		rejectValidation(err);
	}

	const repoRef = parseRepoUrl(parsed.url);
	const attachedRepoRef = parsed.repoUrl ? parseRepoUrl(parsed.repoUrl) : null;
	const alphaFreeUnlock = resolveAlphaFreeUnlock(env);
	const targetType = telemetryTargetType(repoRef, attachedRepoRef);
	const mode = telemetryMode(alphaFreeUnlock);

	logFunnelEvent('scan_started', {
		mode,
		targetType,
		surface: 'api',
		source: 'api'
	});

	try {
		await assertDailyScanBudget(env?.REPORTS, env?.LIMITER);
	} catch (err) {
		if (isDailyCapacityError(err)) {
			logFunnelEvent('capacity_reached', {
				mode,
				targetType,
				surface: 'api',
				source: 'api',
				reason: 'daily_scan_capacity_reached'
			});
		}
		throw err;
	}
	await assertScanRateLimit(env?.REPORTS, clientIp(request), env?.LIMITER);

	const deps = createScanDeps(env);
	const report = repoRef
		? await scanRepo(repoRef, { token: env?.GITHUB_TOKEN })
		: await scanUrl(parsed.url, deps);
	const repoReport =
		!repoRef && attachedRepoRef
			? await scanRepo(attachedRepoRef, { token: env?.GITHUB_TOKEN })
			: null;
	const fullReport = repoReport ? mergeDeployAndRepoReports(report, repoReport) : report;
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

	const sanitized = sanitizeReport(fullReport, unlocked, {
		previousScore: unlocked ? parsed.previousScore : undefined
	});

	// Store the free (prompt-stripped) version so share links never leak paid prompts.
	if (env?.REPORTS) {
		const stored = unlocked ? sanitizeReport(fullReport, false) : sanitized;
		const reportId = await saveReport(env.REPORTS, stored);
		if (reportId) {
			sanitized.reportId = reportId;
			const previous = await appendHistory(env.REPORTS, fullReport.finalUrl, {
				id: reportId,
				score: fullReport.score,
				verdict: fullReport.verdict,
				at: fullReport.scannedAt,
				issues: issueMap(fullReport.checks)
			});
			if (previous.length > 0) {
				sanitized.history = previous
					.slice(-5)
					.map(({ id, score, verdict, at }) => ({ id, score, verdict, at }));
				const lastIssues = previous.at(-1)?.issues;
				if (lastIssues) sanitized.scanDiff = computeScanDiff(lastIssues, fullReport.checks);
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
	if (unlocked && env?.AI && !repoRef && fullReport.scanCoverage !== 'blocked') {
		const allowed = await reserveAiCopyReview(env.REPORTS, env.LIMITER);
		if (allowed) {
			const review = await buildCopyReview(env.AI, {
				url: fullReport.finalUrl,
				title: fullReport.socialPreview?.title ?? null,
				description: fullReport.socialPreview?.description ?? null,
				topIssues: fullReport.checks
					.filter((c) => c.status !== 'pass')
					.slice(0, 5)
					.map((c) => `${c.title}: ${c.message}`)
			});
			if (review) sanitized.aiCopyReview = review;
		}
	}

	const issueCount = sanitized.checks.filter((c) => c.status !== 'pass').length;
	const warnCount = sanitized.checks.filter((c) => c.status === 'warn').length;
	const failCount = sanitized.checks.filter((c) => c.status === 'fail').length;
	const blockerCount = sanitized.checks.filter(
		(c) => c.status === 'fail' && (c.priority === 'p0' || c.priority == null)
	).length;
	const isRescan = unlocked && parsed.previousScore != null;

	logFunnelEvent(isRescan ? 'rescan_completed' : 'scan_completed', {
		verdict: sanitized.verdict,
		score: sanitized.score,
		scoreBucket: scoreBucket(sanitized.score),
		issueCount,
		blockerCount,
		warnCount,
		failCount,
		unlocked,
		mode,
		targetType,
		surface: 'api',
		source: 'api',
		...(sanitized.scoreDelta == null ? {} : { scoreDelta: sanitized.scoreDelta })
	});

	return json(sanitized);
}
