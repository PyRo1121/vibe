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
 *   DEPLOYLINT_API       API base (default https://deploylint.com)
 *   DEPLOYLINT_MIN_SCORE Minimum score (default 80)
 *   DEPLOYLINT_MODE      "gate" (default, exits 1 on blockers) or "advisory" (report only, always exits 0)
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
const minScore = Number(
	process.env.DEPLOYLINT_MIN_SCORE ?? process.env.PREFLIGHT_MIN_SCORE ?? '80'
);
const mode = (process.env.DEPLOYLINT_MODE ?? process.env.PREFLIGHT_MODE ?? 'gate').toLowerCase();
const advisory = mode === 'advisory';

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
	console.error('  DEPLOYLINT_API        API base (default https://deploylint.com)');
	console.error('  DEPLOYLINT_MIN_SCORE  Minimum score, 0-100 (default 80)');
	console.error('  DEPLOYLINT_MODE       gate or advisory (default gate)');
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
	const lines = [
		`Deploylint ${advisory ? 'advisory' : 'gate'}: ${result.pass ? 'PASS' : 'FAIL'}`,
		`URL: ${report.finalUrl}`,
		`Score: ${report.score} · Verdict: ${String(report.verdict).toUpperCase()}`,
		report.verdictMessage
	];
	const link = permalink(report);
	if (link) lines.push(`Report: ${link}`);
	if (result.reasons.length > 0) {
		lines.push('', 'Failures:');
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
		lines.push('**Blocking:**', '');
		for (const reason of result.reasons) lines.push(`- ${reason}`);
		lines.push('');
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

async function upsertPrComment(ctx, markdown) {
	const headers = {
		Authorization: `Bearer ${ctx.token}`,
		Accept: 'application/vnd.github+json',
		'Content-Type': 'application/json',
		'User-Agent': 'preflight-gate'
	};
	const base = `https://api.github.com/repos/${ctx.repo}/issues/${ctx.prNumber}/comments`;
	try {
		const list = await fetch(`${base}?per_page=100`, { headers });
		if (list.ok) {
			const comments = await list.json();
			const existing = comments.find(
				(c) =>
					c.user?.login === 'github-actions[bot]' &&
					typeof c.body === 'string' &&
					c.body.includes(COMMENT_MARKER)
			);
			if (existing) {
				await fetch(`https://api.github.com/repos/${ctx.repo}/issues/comments/${existing.id}`, {
					method: 'PATCH',
					headers,
					body: JSON.stringify({ body: markdown })
				});
				console.log('Updated Deploylint PR comment.');
				return;
			}
		}
		const created = await fetch(base, {
			method: 'POST',
			headers,
			body: JSON.stringify({ body: markdown })
		});
		console.log(
			created.ok ? 'Posted Deploylint PR comment.' : `PR comment failed (HTTP ${created.status}).`
		);
	} catch (err) {
		console.log(`PR comment failed: ${err instanceof Error ? err.message : err}`);
	}
}

async function main() {
	console.log(`Scanning ${targetUrl} via ${apiBase} …`);
	const res = await fetch(`${apiBase}/api/scan`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ url: targetUrl })
	});

	const body = await res.json().catch(() => null);
	if (!res.ok) {
		const message = body && typeof body.message === 'string' ? body.message : `HTTP ${res.status}`;
		throw new Error(message);
	}

	const result = evaluateGate(body);
	if (flags.has('--json')) {
		console.log(
			JSON.stringify({
				pass: result.pass,
				score: body.score,
				verdict: body.verdict,
				reasons: result.reasons,
				reportId: body.reportId ?? null,
				finalUrl: body.finalUrl
			})
		);
		process.exit(result.pass || advisory ? 0 : 1);
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

	process.exit(result.pass || advisory ? 0 : 1);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(2);
});
