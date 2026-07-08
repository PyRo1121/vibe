#!/usr/bin/env node
/**
 * Zero-install Deploylint deploy gate — calls hosted /api/scan and exits non-zero on blockers.
 *
 * Usage:
 *   node gate-remote.mjs https://your-app.com
 *   DEPLOYLINT_URL=https://your-app.com node gate-remote.mjs
 *
 * Env:
 *   DEPLOYLINT_URL       Target URL (or first CLI arg)
 *   DEPLOYLINT_REPO_URL  Optional GitHub repository URL/label for deploy-path repo checks
 *   DEPLOYLINT_PROJECT_ID Workspace project id for persistent CI report history
 *   DEPLOYLINT_INGEST_TOKEN Workspace project write token for persistent CI report history
 *   DEPLOYLINT_API       API base (default https://deploylint.com)
 *   DEPLOYLINT_MIN_SCORE Minimum score (default 80)
 *   DEPLOYLINT_MODE      "gate" (default, exits 1 on blockers) or "advisory" (report only, always exits 0)
 *   DEPLOYLINT_FETCH_TIMEOUT_MS  Per-request timeout (default 30000)
 *   DEPLOYLINT_FETCH_RETRIES     Retry count for transient network failures (default 2)
 *   DEPLOYLINT_FETCH_RETRY_DELAY_MS  Initial retry delay (default 500)
 *   DEPLOYLINT_GITHUB_API  GitHub API base for PR comments (default https://api.github.com)
 *
 * Backward-compatible aliases:
 *   DEPLOYLINT_GATE_URL, PREFLIGHT_URL, PREFLIGHT_GATE_URL, PREFLIGHT_API, PREFLIGHT_MIN_SCORE, PREFLIGHT_MODE
 *
 * GitHub Actions extras:
 *   - Appends a markdown report to the job summary (GITHUB_STEP_SUMMARY).
 *   - If a pull_request workflow provides GITHUB_TOKEN and write permissions,
 *     posts/updates a PR comment with the verdict, score, blockers, and report permalink.
 */
import { readFileSync, appendFileSync } from 'node:fs';

const P0_IDS = new Set([
	'reachable',
	'fetch',
	'https',
	'secrets',
	'privacy',
	'noindex',
	'robots-block',
	'env-committed',
	'form-security',
	'dependency-vulns',
	'workflow-pull-request-target',
	'checkout-server-owned',
	'webhook-signature-missing',
	'payment-env-safety',
	'docker-env-copy',
	'exposed-env',
	'exposed-git',
	'exposed-backup'
]);

const COMMENT_MARKER = '<!-- preflight-gate -->';

const apiBase = (
	process.env.DEPLOYLINT_API ??
	process.env.PREFLIGHT_API ??
	'https://deploylint.com'
).replace(/\/$/, '');
const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg === '-h' || arg.startsWith('--')));
const positionalArgs = args.filter((arg) => arg !== '-h' && !arg.startsWith('--'));
const targetUrl =
	positionalArgs[0]?.trim() ||
	process.env.DEPLOYLINT_URL?.trim() ||
	process.env.DEPLOYLINT_GATE_URL?.trim() ||
	process.env.PREFLIGHT_URL?.trim() ||
	process.env.PREFLIGHT_GATE_URL?.trim();
const projectId = process.env.DEPLOYLINT_PROJECT_ID?.trim();
const ingestToken = process.env.DEPLOYLINT_INGEST_TOKEN?.trim();
const repoUrl = process.env.DEPLOYLINT_REPO_URL?.trim();
const minScore = Number(
	process.env.DEPLOYLINT_MIN_SCORE ?? process.env.PREFLIGHT_MIN_SCORE ?? '80'
);
const mode = (process.env.DEPLOYLINT_MODE ?? process.env.PREFLIGHT_MODE ?? 'gate').toLowerCase();
const advisory = mode === 'advisory';
const fetchTimeoutMs = envInt('DEPLOYLINT_FETCH_TIMEOUT_MS', 30_000, 1);
const fetchRetries = envInt('DEPLOYLINT_FETCH_RETRIES', 2);
const fetchRetryDelayMs = envInt('DEPLOYLINT_FETCH_RETRY_DELAY_MS', 500);
const githubApiBase = (process.env.DEPLOYLINT_GITHUB_API ?? 'https://api.github.com').replace(
	/\/$/,
	''
);

function printHelp() {
	console.error('Usage: node gate-remote.mjs <url>');
	console.error('   or: DEPLOYLINT_URL=https://example.com node gate-remote.mjs');
	console.error('');
	console.error('Options:');
	console.error('  --json      Print structured JSON instead of markdown text');
	console.error('  --help      Show this help');
	console.error('');
	console.error('Env:');
	console.error('  DEPLOYLINT_URL        Target URL or public GitHub repo');
	console.error('  DEPLOYLINT_REPO_URL   Optional GitHub repo for combined deploy-path checks');
	console.error('  DEPLOYLINT_PROJECT_ID Workspace project id for persistent report history');
	console.error('  DEPLOYLINT_INGEST_TOKEN Workspace write token for persistent report history');
	console.error('  DEPLOYLINT_API        API base (default https://deploylint.com)');
	console.error('  DEPLOYLINT_MIN_SCORE  Minimum score, 0-100 (default 80)');
	console.error('  DEPLOYLINT_MODE       gate or advisory (default gate)');
	console.error('  DEPLOYLINT_FETCH_TIMEOUT_MS  Per-request timeout in milliseconds');
	console.error('  DEPLOYLINT_FETCH_RETRIES     Retry count for transient network failures');
	console.error('  DEPLOYLINT_FETCH_RETRY_DELAY_MS  Initial retry delay in milliseconds');
	console.error('  DEPLOYLINT_GITHUB_API  GitHub API base for PR comments');
	console.error('');
	console.error('Compatibility aliases: DEPLOYLINT_GATE_URL, PREFLIGHT_URL, PREFLIGHT_GATE_URL');
}

if (flags.has('--help') || flags.has('-h')) {
	printHelp();
	process.exit(0);
}

if (!targetUrl) {
	printHelp();
	process.exit(2);
}

if (!Number.isFinite(minScore) || minScore < 0 || minScore > 100) {
	console.error('DEPLOYLINT_MIN_SCORE must be a number from 0 to 100.');
	process.exit(2);
}

if (!['gate', 'advisory'].includes(mode)) {
	console.error('DEPLOYLINT_MODE must be "gate" or "advisory".');
	process.exit(2);
}

function envInt(name, fallback, min = 0) {
	const rawValue = process.env[name];
	if (rawValue === undefined || rawValue.trim() === '') return fallback;
	const value = Number(rawValue);
	return Number.isFinite(value) && value >= min ? value : fallback;
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt) {
	return fetchRetryDelayMs * 2 ** attempt;
}

function describeFetchError(err) {
	return err instanceof Error ? err.message : String(err);
}

function isRetryableFetchError(err) {
	if (!(err instanceof Error)) return false;
	return /fetch failed|network|socket|timed out|timeout|aborted|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(
		err.message
	);
}

async function drainResponse(res) {
	await res.arrayBuffer().catch(() => {});
}

async function fetchWithTimeout(url, init, label) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);
	let timedOut = false;

	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} catch (err) {
		timedOut = controller.signal.aborted;
		if (timedOut)
			throw new Error(`Timed out after ${fetchTimeoutMs}ms while ${label}`, { cause: err });
		throw err;
	} finally {
		clearTimeout(timeout);
	}
}

async function fetchWithRetry(url, init, label) {
	for (let attempt = 0; ; attempt += 1) {
		try {
			return await fetchWithTimeout(url, init, label);
		} catch (err) {
			if (attempt >= fetchRetries || !isRetryableFetchError(err)) throw err;
			const delayMs = retryDelayMs(attempt);
			console.warn(
				`[gate] fetch retry ${attempt + 1}/${fetchRetries} in ${delayMs}ms after ${describeFetchError(err)}`
			);
			await sleep(delayMs);
		}
	}
}

function evaluateGate(report) {
	const reasons = [];

	if (report.verdict === 'no-go') {
		reasons.push(`Verdict NO-GO: ${report.verdictMessage}`);
	}
	if (report.score < minScore) {
		reasons.push(`Score ${report.score} is below minimum ${minScore}`);
	}
	for (const check of report.checks ?? []) {
		if (check.status !== 'fail' || !P0_IDS.has(check.id)) continue;
		reasons.push(`P0 blocker: ${check.title} — ${check.message}`);
	}

	return { pass: reasons.length === 0, reasons };
}

function permalink(report) {
	return report.reportId ? `${apiBase}/r/${report.reportId}` : null;
}

function formatReport(report, result) {
	const status = advisory && !result.pass ? 'ADVISORY' : result.pass ? 'PASS' : 'FAIL';
	const reasonHeading = advisory ? 'Advisory findings:' : 'Failures:';
	const lines = [
		`Deploylint ${advisory ? 'advisory' : 'gate'}: ${status}`,
		`URL: ${report.finalUrl}`,
		`Score: ${report.score} · Verdict: ${String(report.verdict).toUpperCase()}`,
		report.verdictMessage
	];
	const link = permalink(report);
	if (link) lines.push(`Report: ${link}`);
	if (result.reasons.length > 0) {
		lines.push('', reasonHeading);
		for (const reason of result.reasons) lines.push(`- ${reason}`);
	}
	if (advisory && result.reasons.length > 0) {
		lines.push('', 'Advisory mode — not blocking the build.');
	}
	return lines.join('\n');
}

function formatMarkdown(report, result) {
	const icon = result.pass ? '✅' : advisory ? '⚠️' : '❌';
	const failing = (report.checks ?? []).filter((c) => c.status === 'fail');
	const warning = (report.checks ?? []).filter((c) => c.status === 'warn');
	const lines = [
		COMMENT_MARKER,
		`## ${icon} Deploylint — ${String(report.verdict).toUpperCase()} · ${report.score}/100`,
		'',
		`**${report.finalUrl}** · ${failing.length} failing · ${warning.length} warnings · ${report.summary?.pass ?? '?'} passing`,
		''
	];
	if (result.reasons.length > 0) {
		lines.push(advisory ? '**Advisory findings:**' : '**Blocking:**', '');
		for (const reason of result.reasons) lines.push(`- ${reason}`);
		lines.push('');
		if (advisory) lines.push('_Advisory mode — not blocking the build._', '');
	}
	if (failing.length > 0) {
		lines.push('<details><summary>Failing checks</summary>', '');
		for (const c of failing) lines.push(`- **${c.title}** — ${c.message}`);
		lines.push('', '</details>', '');
	}
	const link = permalink(report);
	if (link)
		lines.push(`[Full report](${link})${advisory ? ' · advisory mode (non-blocking)' : ''}`);
	return lines.join('\n');
}

/** Detects a GitHub Actions pull_request run; returns null anywhere else. */
function githubPrContext() {
	const token = process.env.GITHUB_TOKEN;
	const repo = process.env.GITHUB_REPOSITORY;
	const eventPath = process.env.GITHUB_EVENT_PATH;
	if (!token || !repo || !eventPath) return null;
	if (!(process.env.GITHUB_EVENT_NAME ?? '').startsWith('pull_request')) return null;
	try {
		const event = JSON.parse(readFileSync(eventPath, 'utf8'));
		const prNumber = event.pull_request?.number ?? event.number;
		if (!prNumber) return null;
		return { token, repo, prNumber };
	} catch {
		return null;
	}
}

function githubEvent() {
	const eventPath = process.env.GITHUB_EVENT_PATH;
	if (!eventPath) return null;
	try {
		return JSON.parse(readFileSync(eventPath, 'utf8'));
	} catch {
		return null;
	}
}

function githubCiContext() {
	const event = githubEvent();
	const pullRequest = event?.pull_request;
	const isPullRequestRun = (process.env.GITHUB_EVENT_NAME ?? '').startsWith('pull_request');
	const prNumber = isPullRequestRun ? (pullRequest?.number ?? event?.number) : null;
	return {
		...(pullRequest?.head?.sha || process.env.GITHUB_SHA
			? { commitSha: pullRequest?.head?.sha ?? process.env.GITHUB_SHA }
			: {}),
		...(pullRequest?.head?.ref || process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME
			? {
					branch:
						pullRequest?.head?.ref ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME
				}
			: {}),
		...(prNumber ? { pullRequest: String(prNumber) } : {})
	};
}

async function upsertPrComment(ctx, markdown) {
	const headers = {
		Authorization: `Bearer ${ctx.token}`,
		Accept: 'application/vnd.github+json',
		'Content-Type': 'application/json',
		'User-Agent': 'preflight-gate'
	};
	const base = `${githubApiBase}/repos/${ctx.repo}/issues/${ctx.prNumber}/comments`;
	try {
		const list = await fetchWithRetry(
			`${base}?per_page=100`,
			{ headers },
			'list GitHub PR comments'
		);
		if (list.ok) {
			const comments = await list.json();
			const existing = comments.find(
				(c) =>
					c.user?.login === 'github-actions[bot]' &&
					typeof c.body === 'string' &&
					c.body.includes(COMMENT_MARKER)
			);
			if (existing) {
				const updated = await fetchWithRetry(
					`${githubApiBase}/repos/${ctx.repo}/issues/comments/${existing.id}`,
					{
						method: 'PATCH',
						headers,
						body: JSON.stringify({ body: markdown })
					},
					'update GitHub PR comment'
				);
				await drainResponse(updated);
				console.log(
					updated.ok
						? 'Updated Deploylint PR comment.'
						: `PR comment failed (HTTP ${updated.status}).`
				);
				return;
			}
		}
		const created = await fetchWithRetry(
			base,
			{
				method: 'POST',
				headers,
				body: JSON.stringify({ body: markdown })
			},
			'create GitHub PR comment'
		);
		await drainResponse(created);
		console.log(
			created.ok ? 'Posted Deploylint PR comment.' : `PR comment failed (HTTP ${created.status}).`
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.log(`PR comment failed: ${message}`);
	}
}

async function main() {
	console.log(`Scanning ${targetUrl} via ${apiBase} …`);
	const scanPayload = {
		url: targetUrl,
		...(repoUrl ? { repoUrl } : {}),
		...(projectId ? { projectId } : {}),
		...(ingestToken ? { ingestToken } : {}),
		...githubCiContext()
	};
	const res = await fetchWithRetry(
		`${apiBase}/api/scan`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(scanPayload)
		},
		`POST ${apiBase}/api/scan`
	);

	const body = await res.json().catch(() => null);
	if (!res.ok) {
		const message = body && typeof body.message === 'string' ? body.message : `HTTP ${res.status}`;
		throw new Error(message);
	}

	const result = evaluateGate(body);
	const effectivePass = result.pass || advisory;
	if (flags.has('--json')) {
		console.log(
			JSON.stringify({
				pass: effectivePass,
				gatePass: result.pass,
				advisory,
				score: body.score,
				verdict: body.verdict,
				reasons: result.reasons,
				reportId: body.reportId ?? null,
				finalUrl: body.finalUrl
			})
		);
		process.exitCode = effectivePass ? 0 : 1;
		return;
	}
	console.log(formatReport(body, result));

	const markdown = formatMarkdown(body, result);
	if (process.env.GITHUB_STEP_SUMMARY) {
		try {
			appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
		} catch {
			// Summary is cosmetic — never fail the gate over it.
		}
	}
	const prCtx = githubPrContext();
	if (prCtx) await upsertPrComment(prCtx, markdown);

	process.exitCode = effectivePass ? 0 : 1;
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exitCode = 2;
});
