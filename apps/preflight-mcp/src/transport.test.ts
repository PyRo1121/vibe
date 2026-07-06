import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterEach, describe, expect, it } from 'vitest';

import type { ScanReport } from './types.js';

const packageRoot = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const transportTimeoutMs = 10_000;
let activeClient: Client | null = null;
let activeServer: Server | null = null;

function report(overrides: Partial<ScanReport> = {}): ScanReport {
	return {
		url: 'https://app.test',
		finalUrl: 'https://app.test/',
		score: 72,
		verdict: 'no-go',
		verdictMessage: 'Fix blockers before launch',
		summary: { pass: 10, warn: 1, fail: 1 },
		checks: [
			{
				id: 'privacy',
				title: 'Privacy policy',
				status: 'fail',
				message: 'No privacy link',
				priority: 'p0',
				fixPrompt: 'Add /privacy.'
			}
		],
		reportId: 'abc12345',
		samplePromptId: 'privacy',
		...overrides
	};
}

function stringEnv(overrides: Record<string, string>): Record<string, string> {
	const env = Object.fromEntries(
		Object.entries(process.env).filter((entry): entry is [string, string] => {
			return typeof entry[1] === 'string';
		})
	);
	return { ...env, ...overrides };
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
	let body = '';
	req.setEncoding('utf8');
	for await (const chunk of req) {
		body += chunk;
	}
	return JSON.parse(body);
}

async function listen(server: Server): Promise<number> {
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			server.off('error', reject);
			resolve();
		});
	});
	return (server.address() as AddressInfo).port;
}

async function closeServer(server: Server): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		server.close((err) => {
			if (err) {
				reject(err);
				return;
			}
			resolve();
		});
	});
}

function textContent(result: Awaited<ReturnType<Client['callTool']>>): string {
	if (!('content' in result)) {
		throw new Error('Expected tool content result');
	}
	const content = result.content[0];
	if (content?.type !== 'text') {
		throw new Error('Expected text tool content');
	}
	return content.text;
}

afterEach(async () => {
	if (activeClient) {
		await activeClient.close();
		activeClient = null;
	}
	if (activeServer) {
		await closeServer(activeServer);
		activeServer = null;
	}
});

describe('stdio transport integration', () => {
	it(
		'starts the CLI, lists tools, and calls the deploy gate over MCP stdio',
		async () => {
			const scanRequests: unknown[] = [];
			activeServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
				if (req.method !== 'POST' || req.url !== '/api/scan') {
					res.writeHead(404).end();
					return;
				}

				scanRequests.push(await readJsonBody(req));
				res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(report()));
			});
			const port = await listen(activeServer);

			const transport = new StdioClientTransport({
				command: process.execPath,
				args: ['--import', 'tsx', 'src/index.ts'],
				cwd: packageRoot,
				env: stringEnv({ DEPLOYLINT_API: `http://127.0.0.1:${port}` }),
				stderr: 'pipe'
			});
			const stderrChunks: Buffer[] = [];
			transport.stderr?.on('data', (chunk) => stderrChunks.push(Buffer.from(chunk)));
			activeClient = new Client({ name: 'preflight-mcp-transport-test', version: '0.0.0' });

			await activeClient.connect(transport);
			const tools = await activeClient.listTools();
			expect(tools.tools.map((tool) => tool.name).toSorted()).toEqual([
				'deploylint_gate',
				'deploylint_scan',
				'preflight_gate',
				'preflight_scan'
			]);

			const result = await activeClient.callTool({
				name: 'deploylint_gate',
				arguments: {
					url: ' https://app.test ',
					format: 'json',
					min_score: 90
				}
			});
			const payload = JSON.parse(textContent(result)) as Record<string, unknown>;

			expect(payload).toMatchObject({
				pass: false,
				minScore: 90,
				reasons: expect.arrayContaining([
					expect.stringContaining('NO-GO'),
					expect.stringContaining('Score 72 below minimum 90'),
					expect.stringContaining('P0')
				])
			});
			expect(scanRequests).toEqual([{ url: 'https://app.test' }]);
			expect(Buffer.concat(stderrChunks).toString('utf8')).toBe('');
		},
		transportTimeoutMs
	);
});
