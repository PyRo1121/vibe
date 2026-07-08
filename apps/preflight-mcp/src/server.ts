import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { fetchScan } from './api.js';
import {
	buildAgentGatePayload,
	buildAgentScanPayload,
	formatGateMarkdown,
	formatScanMarkdown
} from './format.js';
import { evaluateGate } from './gate.js';
import type { OutputFormat, ScanOptions, ScanReport } from './types.js';

const formatSchema = z
	.enum(['markdown', 'json'])
	.optional()
	.describe('Response format: markdown (default) or json for agent parsing');

export const scanZod = z.object({
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
		.describe('Stripe checkout session id (cs_live_...) to include paid fix prompts'),
	previous_score: z
		.number()
		.int()
		.min(0)
		.max(100)
		.optional()
		.describe('Baseline score for re-scan delta (use with unlock_session_id)')
});

export const gateZod = scanZod.extend({
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

export type ScanArgs = z.infer<typeof scanZod>;
export type GateArgs = z.infer<typeof gateZod>;
export type ScanFetcher = (opts: ScanOptions) => Promise<ScanReport>;

interface ToolTextResult {
	[key: string]: unknown;
	content: Array<{ type: 'text'; text: string }>;
}

export function resolveFormat(format?: string): OutputFormat {
	return format === 'json' ? 'json' : 'markdown';
}

export function createHandlers(scanFetcher: ScanFetcher = fetchScan) {
	return {
		async handleScan(this: void, args: ScanArgs): Promise<ToolTextResult> {
			const report = await scanFetcher({
				url: args.url,
				unlockSessionId: args.unlock_session_id,
				previousScore: args.previous_score
			});
			const maxIssues = args.max_issues ?? 25;
			const format = resolveFormat(args.format);

			if (format === 'json') {
				const payload = buildAgentScanPayload(report, maxIssues);
				return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
			}

			return {
				content: [{ type: 'text', text: formatScanMarkdown(report, maxIssues) }]
			};
		},

		async handleGate(this: void, args: GateArgs): Promise<ToolTextResult> {
			const report = await scanFetcher({
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
				return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
			}

			return {
				content: [
					{
						type: 'text',
						text: formatGateMarkdown(report, gate, minScore, advisory, maxIssues)
					}
				]
			};
		}
	};
}

export function createDeploylintServer(scanFetcher: ScanFetcher = fetchScan): McpServer {
	const server = new McpServer({
		name: 'deploylint',
		version: '0.3.0'
	});
	const handlers = createHandlers(scanFetcher);

	server.tool(
		'deploylint_scan',
		'Launch-readiness audit: score, verdict, embarrassment risks, issues, and fix prompts (one free sample; pass unlock_session_id for all).',
		scanZod.shape,
		handlers.handleScan
	);

	server.tool(
		'deploylint_gate',
		'PASS/FAIL deploy gate: NO-GO verdict, score floor, and P0 blockers. Use advisory:true to report without blocking.',
		gateZod.shape,
		handlers.handleGate
	);

	server.tool(
		'preflight_scan',
		'[deprecated] Alias for deploylint_scan',
		scanZod.shape,
		handlers.handleScan
	);

	server.tool(
		'preflight_gate',
		'[deprecated] Alias for deploylint_gate',
		gateZod.shape,
		handlers.handleGate
	);

	return server;
}
