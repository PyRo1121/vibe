import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { evaluateGate, type GateScanReport } from './gate.js';

const apiBase = (
	process.env.DEPLOYLINT_API ??
	process.env.PREFLIGHT_API ??
	'https://lint.latham.cloud'
).replace(/\/$/, '');

async function scanUrl(url: string): Promise<GateScanReport> {
	const res = await fetch(`${apiBase}/api/scan`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ url })
	});
	const body = (await res.json().catch(() => null)) as GateScanReport | { message?: string } | null;
	if (!res.ok) {
		const message = body && 'message' in body ? body.message : `HTTP ${res.status}`;
		throw new Error(message ?? `Scan failed (${res.status})`);
	}
	return body as GateScanReport;
}

function formatScanSummary(report: GateScanReport): string {
	const failing = report.checks.filter((c) => c.status !== 'pass');
	const lines = [
		`# Deploylint scan`,
		``,
		`- **URL:** ${report.finalUrl}`,
		`- **Score:** ${report.score}/100`,
		`- **Verdict:** ${report.verdict.toUpperCase()}`,
		`- **Summary:** ${report.summary.pass} pass · ${report.summary.warn} warn · ${report.summary.fail} fail`,
		``,
		report.verdictMessage,
		``
	];

	if (failing.length > 0) {
		lines.push(`## Issues (${failing.length})`, ``);
		for (const check of failing.slice(0, 15)) {
			lines.push(`- **${check.title}** (${check.status}): ${check.message}`);
		}
		if (failing.length > 15) {
			lines.push(`- …and ${failing.length - 15} more`);
		}
	}

	return lines.join('\n');
}

function runGate(report: GateScanReport, minScore: number) {
	const gate = evaluateGate(report, minScore);
	const lines = [
		gate.pass ? '✅ PASS — clear to ship' : '❌ FAIL — fix before posting publicly',
		'',
		formatScanSummary(report)
	];
	if (gate.reasons.length > 0) {
		lines.push('', '## Gate failures', '');
		for (const reason of gate.reasons) lines.push(`- ${reason}`);
	}
	return { gate, text: lines.join('\n') };
}

const server = new McpServer({
	name: 'deploylint',
	version: '0.2.0'
});

const scanSchema = {
	url: z.string().describe('Public HTTPS URL to scan, e.g. https://example.com')
};

const gateSchema = {
	...scanSchema,
	min_score: z
		.number()
		.int()
		.min(0)
		.max(100)
		.optional()
		.describe('Minimum score required (default 80)')
};

async function handleScan({ url }: { url: string }) {
	const report = await scanUrl(url);
	return { content: [{ type: 'text' as const, text: formatScanSummary(report) }] };
}

async function handleGate({ url, min_score }: { url: string; min_score?: number }) {
	const report = await scanUrl(url);
	const minScore = min_score ?? 80;
	const { text } = runGate(report, minScore);
	return { content: [{ type: 'text' as const, text }] };
}

server.tool(
	'deploylint_scan',
	'Run a Deploylint launch-readiness audit on a public URL. Returns score, verdict, and top issues.',
	scanSchema,
	handleScan
);

server.tool(
	'deploylint_gate',
	'Scan a URL and return PASS/FAIL for launch readiness (P0 blockers + minimum score).',
	gateSchema,
	handleGate
);

/** @deprecated Use deploylint_scan */
server.tool(
	'preflight_scan',
	'[deprecated] Alias for deploylint_scan',
	scanSchema,
	handleScan
);

/** @deprecated Use deploylint_gate */
server.tool(
	'preflight_gate',
	'[deprecated] Alias for deploylint_gate',
	gateSchema,
	handleGate
);

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
