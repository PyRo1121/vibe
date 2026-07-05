import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { fetchScan } from './api.js';
import {
	buildAgentGatePayload,
	buildAgentScanPayload,
	formatGateMarkdown,
	formatScanMarkdown
} from './format.js';
import { evaluateGate } from './gate.js';
import type { OutputFormat } from './types.js';

const formatSchema = z
	.enum(['markdown', 'json'])
	.optional()
	.describe('Response format: markdown (default) or json for agent parsing');

const scanZod = z.object({
	url: z.string().describe('HTTPS site URL or github.com/owner/repo to audit for launch readiness'),
	format: formatSchema,
	max_issues: z
		.number()
		.int()
		.min(1)
		.max(50)
		.optional()
		.describe('Max non-passing issues to return (default 25)'),
	unlock_session_id: z
		.string()
		.optional()
		.describe('Stripe checkout session id (cs_live_…) to include paid fix prompts'),
	previous_score: z
		.number()
		.int()
		.min(0)
		.max(100)
		.optional()
		.describe('Baseline score for re-scan delta (use with unlock_session_id)')
});

const gateZod = scanZod.extend({
	min_score: z
		.number()
		.int()
		.min(0)
		.max(100)
		.optional()
		.describe('Minimum score required (default 80)'),
	advisory: z
		.boolean()
		.optional()
		.describe('If true, report failures but always return pass (non-blocking)')
});

type ScanArgs = z.infer<typeof scanZod>;
type GateArgs = z.infer<typeof gateZod>;

function resolveFormat(format?: string): OutputFormat {
	return format === 'json' ? 'json' : 'markdown';
}

async function handleScan(args: ScanArgs) {
	const report = await fetchScan({
		url: args.url,
		unlockSessionId: args.unlock_session_id,
		previousScore: args.previous_score
	});
	const maxIssues = args.max_issues ?? 25;
	const format = resolveFormat(args.format);

	if (format === 'json') {
		const payload = buildAgentScanPayload(report, maxIssues);
		return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
	}

	return {
		content: [{ type: 'text' as const, text: formatScanMarkdown(report, maxIssues) }]
	};
}

async function handleGate(args: GateArgs) {
	const report = await fetchScan({
		url: args.url,
		unlockSessionId: args.unlock_session_id,
		previousScore: args.previous_score
	});
	const minScore = args.min_score ?? 80;
	const advisory = args.advisory ?? false;
	const maxIssues = args.max_issues ?? 25;
	const gate = evaluateGate(report, minScore);
	const format = resolveFormat(args.format);

	if (format === 'json') {
		const payload = buildAgentGatePayload(report, gate, minScore, advisory, maxIssues);
		return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
	}

	return {
		content: [
			{
				type: 'text' as const,
				text: formatGateMarkdown(report, gate, minScore, advisory, maxIssues)
			}
		]
	};
}

const server = new McpServer({
	name: 'deploylint',
	version: '0.3.0'
});

server.tool(
	'deploylint_scan',
	'Launch-readiness audit: score, verdict, embarrassment risks, issues, and fix prompts (one free sample; pass unlock_session_id for all).',
	scanZod.shape,
	handleScan
);

server.tool(
	'deploylint_gate',
	'PASS/FAIL deploy gate: NO-GO verdict, score floor, and P0 blockers. Use advisory:true to report without blocking.',
	gateZod.shape,
	handleGate
);

/** @deprecated Use deploylint_scan */
server.tool('preflight_scan', '[deprecated] Alias for deploylint_scan', scanZod.shape, handleScan);

/** @deprecated Use deploylint_gate */
server.tool('preflight_gate', '[deprecated] Alias for deploylint_gate', gateZod.shape, handleGate);

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
