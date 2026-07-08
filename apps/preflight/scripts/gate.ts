#!/usr/bin/env npx tsx
import { evaluateGate, formatGateReport } from '../src/lib/gate/evaluate';
/**
 * CI / local gate — scan a URL and exit non-zero when launch blockers remain.
 *
 * Usage:
 *   npm run gate -- https://your-app.com
 *   DEPLOYLINT_URL=https://your-app.com npm run gate
 *
 * Env:
 *   DEPLOYLINT_URL       Target URL (or first CLI arg)
 *   DEPLOYLINT_API       API base (default https://deploylint.com)
 *   DEPLOYLINT_MIN_SCORE Minimum score (default 80)
 *   DEPLOYLINT_MODE      "gate" (default, exits 1 on blockers) or "advisory" (report only, always exits 0)
 *   DEPLOYLINT_FETCH_TIMEOUT_MS  Per-request timeout (default 30000)
 *   DEPLOYLINT_FETCH_RETRIES     Retry count for transient network failures (default 2)
 *   DEPLOYLINT_FETCH_RETRY_DELAY_MS  Initial retry delay (default 500)
 *
 * Backward-compatible aliases:
 *   DEPLOYLINT_GATE_URL, PREFLIGHT_URL, PREFLIGHT_GATE_URL, PREFLIGHT_API, PREFLIGHT_MIN_SCORE, PREFLIGHT_MODE
 */
import type { ScanReport } from '../src/lib/scan/types';

const apiBase = (
	process.env.DEPLOYLINT_API ??
	process.env.PREFLIGHT_API ??
	'https://deploylint.com'
).replace(/\/$/, '');
const targetUrlInput =
	process.argv[2]?.trim() ||
	process.env.DEPLOYLINT_URL?.trim() ||
	process.env.DEPLOYLINT_GATE_URL?.trim() ||
	process.env.PREFLIGHT_URL?.trim() ||
	process.env.PREFLIGHT_GATE_URL?.trim();

if (!targetUrlInput) {
	console.error('Usage: npm run gate -- <url>');
	console.error('   or: DEPLOYLINT_URL=https://example.com npm run gate');
	process.exit(2);
}

const targetUrl = targetUrlInput;

const minScore = Number(
	process.env.DEPLOYLINT_MIN_SCORE ?? process.env.PREFLIGHT_MIN_SCORE ?? '80'
);
const mode = (process.env.DEPLOYLINT_MODE ?? process.env.PREFLIGHT_MODE ?? 'gate').toLowerCase();
const advisory = mode === 'advisory';
const fetchTimeoutMs = envInt('DEPLOYLINT_FETCH_TIMEOUT_MS', 30_000, 1);
const fetchRetries = envInt('DEPLOYLINT_FETCH_RETRIES', 2);
const fetchRetryDelayMs = envInt('DEPLOYLINT_FETCH_RETRY_DELAY_MS', 500);

if (!Number.isFinite(minScore) || minScore < 0 || minScore > 100) {
	console.error('DEPLOYLINT_MIN_SCORE must be a number from 0 to 100.');
	process.exit(2);
}

if (!['gate', 'advisory'].includes(mode)) {
	console.error('DEPLOYLINT_MODE must be "gate" or "advisory".');
	process.exit(2);
}

function envInt(name: string, fallback: number, min = 0): number {
	const rawValue = process.env[name];
	if (rawValue === undefined || rawValue.trim() === '') return fallback;
	const value = Number(rawValue);
	return Number.isFinite(value) && value >= min ? value : fallback;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt: number): number {
	return fetchRetryDelayMs * 2 ** attempt;
}

function describeFetchError(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

function isRetryableFetchError(err: unknown): boolean {
	if (!(err instanceof Error)) return false;
	return /fetch failed|network|socket|timed out|timeout|aborted|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(
		err.message
	);
}

async function fetchWithTimeout(url: string, init: RequestInit, label: string): Promise<Response> {
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

async function fetchWithRetry(url: string, init: RequestInit, label: string): Promise<Response> {
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

async function scanUrl(url: string): Promise<ScanReport> {
	const res = await fetchWithRetry(
		`${apiBase}/api/scan`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url })
		},
		`POST ${apiBase}/api/scan`
	);

	const body = (await res.json().catch(() => null)) as ScanReport | { message?: string } | null;
	if (!res.ok) {
		const message = body && 'message' in body ? body.message : `HTTP ${res.status}`;
		throw new Error(message ?? `Scan failed (${res.status})`);
	}

	return body as ScanReport;
}

async function main() {
	console.log(`Scanning ${targetUrl} via ${apiBase} …`);
	const report = await scanUrl(targetUrl);
	const result = evaluateGate(report, { minScore });
	console.log(formatGateReport(result, { advisory }));
	const code = result.pass || advisory ? 0 : 1;
	setImmediate(() => process.exit(code));
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	setImmediate(() => process.exit(2));
});
