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
const targetUrl =
	process.argv[2]?.trim() ||
	process.env.DEPLOYLINT_URL?.trim() ||
	process.env.DEPLOYLINT_GATE_URL?.trim() ||
	process.env.PREFLIGHT_URL?.trim() ||
	process.env.PREFLIGHT_GATE_URL?.trim();

if (!targetUrl) {
	console.error('Usage: npm run gate -- <url>');
	console.error('   or: DEPLOYLINT_URL=https://example.com npm run gate');
	process.exit(2);
}

const minScore = Number(
	process.env.DEPLOYLINT_MIN_SCORE ?? process.env.PREFLIGHT_MIN_SCORE ?? '80'
);
const mode = (process.env.DEPLOYLINT_MODE ?? process.env.PREFLIGHT_MODE ?? 'gate').toLowerCase();
const advisory = mode === 'advisory';

if (!Number.isFinite(minScore) || minScore < 0 || minScore > 100) {
	console.error('DEPLOYLINT_MIN_SCORE must be a number from 0 to 100.');
	process.exit(2);
}

if (!['gate', 'advisory'].includes(mode)) {
	console.error('DEPLOYLINT_MODE must be "gate" or "advisory".');
	process.exit(2);
}

async function scanUrl(url: string): Promise<ScanReport> {
	const res = await fetch(`${apiBase}/api/scan`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ url })
	});

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
	console.log(formatGateReport(result));
	if (advisory && !result.pass) console.log('Advisory mode - not blocking the build.');
	const code = result.pass || advisory ? 0 : 1;
	setImmediate(() => process.exit(code));
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	setImmediate(() => process.exit(2));
});
