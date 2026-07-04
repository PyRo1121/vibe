#!/usr/bin/env npx tsx
/**
 * CI / local gate — scan a URL and exit non-zero when launch blockers remain.
 *
 * Usage:
 *   npm run gate -- https://your-app.com
 *   PREFLIGHT_URL=https://your-app.com npm run gate
 *
 * Env:
 *   PREFLIGHT_URL       Target URL (or first CLI arg)
 *   PREFLIGHT_API       API base (default https://preflight.latham.cloud)
 *   PREFLIGHT_MIN_SCORE Minimum score (default 80)
 */
import type { ScanReport } from '../src/lib/scan/types';
import { evaluateGate, formatGateReport } from '../src/lib/gate/evaluate';

const apiBase = (process.env.PREFLIGHT_API ?? 'https://preflight.latham.cloud').replace(/\/$/, '');
const targetUrl = process.argv[2]?.trim() || process.env.PREFLIGHT_URL?.trim();

if (!targetUrl) {
	console.error('Usage: npm run gate -- <url>');
	console.error('   or: PREFLIGHT_URL=https://example.com npm run gate');
	process.exit(2);
}

const minScore = Number(process.env.PREFLIGHT_MIN_SCORE ?? '80');

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
	const code = result.pass ? 0 : 1;
	setImmediate(() => process.exit(code));
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	setImmediate(() => process.exit(2));
});
