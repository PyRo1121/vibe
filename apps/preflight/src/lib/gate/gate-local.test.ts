import { spawn } from 'node:child_process';
import { createServer, type IncomingMessage } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(currentDir, '..', '..', '..');
const repoRoot = join(appRoot, '..', '..');
const tsxCli = join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');

interface GateRunResult {
	code: number | null;
	stdout: string;
	stderr: string;
}

function readRequestBody(req: IncomingMessage) {
	return new Promise<string>((resolve, reject) => {
		let body = '';
		req.setEncoding('utf8');
		req.on('data', (chunk) => {
			body += chunk;
		});
		req.on('error', reject);
		req.on('end', () => resolve(body));
	});
}

async function withScanApiResponse<T>(
	status: number,
	body: unknown,
	fn: (apiBase: string) => Promise<T>
): Promise<T> {
	const server = createServer((req, res) => {
		void (async () => {
			if (req.method !== 'POST' || req.url !== '/api/scan') {
				res.writeHead(404);
				res.end('not found');
				return;
			}

			await readRequestBody(req);
			res.writeHead(status, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify(body));
		})().catch((err: unknown) => {
			res.writeHead(500, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ message: err instanceof Error ? err.message : String(err) }));
		});
	});

	await new Promise<void>((resolve) => server.listen({ port: 0, host: '127.0.0.1' }, resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('local server did not bind');

	try {
		return await fn(`http://127.0.0.1:${address.port}`);
	} finally {
		await new Promise<void>((resolve, reject) => {
			server.close((err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}
}

function runLocalGate(apiBase: string) {
	return new Promise<GateRunResult>((resolve, reject) => {
		const child = spawn(process.execPath, [tsxCli, 'scripts/gate.ts', 'https://target.test'], {
			cwd: appRoot,
			env: {
				...process.env,
				DEPLOYLINT_API: apiBase,
				DEPLOYLINT_MODE: 'gate'
			},
			stdio: ['ignore', 'pipe', 'pipe']
		});
		let stdout = '';
		let stderr = '';
		child.stdout.setEncoding('utf8');
		child.stderr.setEncoding('utf8');
		child.stdout.on('data', (chunk) => {
			stdout += chunk;
		});
		child.stderr.on('data', (chunk) => {
			stderr += chunk;
		});
		child.on('error', reject);
		child.on('close', (code) => resolve({ code, stdout, stderr }));
	});
}

describe('local Deploylint gate script', () => {
	it('does not fail main CI when free shared scan capacity is exhausted', async () => {
		await withScanApiResponse(
			503,
			{
				code: 'daily_scan_capacity_reached',
				message:
					'Shared advisory preview capacity reached - try again after midnight UTC. Deploylint stays on Cloudflare Free tier.'
			},
			async (apiBase) => {
				const result = await runLocalGate(apiBase);

				expect(result.code).toBe(0);
				expect(result.stdout).toContain('Deploylint capacity: ADVISORY');
				expect(result.stdout).toContain(
					'not blocking the build while free shared scan capacity is exhausted'
				);
				expect(result.stderr).toBe('');
			}
		);
	});
});
