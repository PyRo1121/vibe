import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const apiBase = (process.env.PREFLIGHT_API ?? 'https://preflight.latham.cloud').replace(/\/$/, '');

interface ScanReport {
	score: number;
	verdict: string;
	verdictMessage: string;
	finalUrl: string;
	checks: { id: string; title: string; status: string; message: string; priority?: string }[];
	summary: { pass: number; warn: number; fail: number };
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

function formatScanSummary(report: ScanReport): string {
	const failing = report.checks.filter((c) => c.status !== 'pass');
	const lines = [
		`# Preflight scan`,
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

function evaluateGate(report: ScanReport, minScore: number): { pass: boolean; reasons: string[] } {
	const reasons: string[] = [];
	const p0Ids = new Set(['reachable', 'fetch', 'https', 'secrets', 'privacy']);

	if (report.verdict === 'no-go') {
		reasons.push(`NO-GO: ${report.verdictMessage}`);
	}
	if (report.score < minScore) {
		reasons.push(`Score ${report.score} below minimum ${minScore}`);
	}
	for (const check of report.checks) {
		if (check.status === 'fail' && p0Ids.has(check.id)) {
			reasons.push(`P0: ${check.title} — ${check.message}`);
		}
	}
	return { pass: reasons.length === 0, reasons };
}

const server = new McpServer({
	name: 'preflight',
	version: '0.1.0'
});

server.tool(
	'preflight_scan',
	'Run a Preflight site readiness audit on a public URL. Returns score, verdict, and top issues.',
	{ url: z.string().describe('Public HTTPS URL to scan, e.g. https://example.com') },
	async ({ url }) => {
		const report = await scanUrl(url);
		return { content: [{ type: 'text', text: formatScanSummary(report) }] };
	}
);

server.tool(
	'preflight_gate',
	'Scan a URL and return PASS/FAIL for launch readiness (P0 blockers + minimum score).',
	{
		url: z.string().describe('Public HTTPS URL to scan'),
		min_score: z
			.number()
			.int()
			.min(0)
			.max(100)
			.optional()
			.describe('Minimum score required (default 80)')
	},
	async ({ url, min_score }) => {
		const report = await scanUrl(url);
		const minScore = min_score ?? 80;
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
		return { content: [{ type: 'text', text: lines.join('\n') }] };
	}
);

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
