import { spawn } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(currentDir, '..', '..', '..');
const scriptPath = join(appRoot, 'scripts', 'gate-remote.mjs');
const tempDirs: string[] = [];

interface GateRunOptions {
	args?: string[];
	env?: NodeJS.ProcessEnv;
}

interface GateRunResult {
	code: number | null;
	stdout: string;
	stderr: string;
}

const failingReport = {
	url: 'https://target.test',
	finalUrl: 'https://target.test/',
	score: 40,
	verdict: 'no-go',
	verdictMessage: 'Do not enable gate mode.',
	reportId: 'report_123',
	summary: { pass: 1, warn: 0, fail: 1 },
	checks: [
		{
			id: 'privacy',
			category: 'legal',
			title: 'Privacy policy',
			status: 'fail',
			message: 'No privacy link',
			fixPrompt: ''
		}
	]
};

const passingReport = {
	url: 'https://target.test',
	finalUrl: 'https://target.test/',
	score: 96,
	verdict: 'go',
	verdictMessage: 'Ready for release.',
	reportId: 'report_ok',
	summary: { pass: 3, warn: 0, fail: 0 },
	checks: [
		{
			id: 'https',
			category: 'security',
			title: 'HTTPS',
			status: 'pass',
			message: 'HTTPS enforced',
			fixPrompt: ''
		}
	]
};

afterEach(() => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (dir) rmSync(dir, { recursive: true, force: true });
	}
});

function makeTempDir() {
	const dir = mkdtempSync(join(tmpdir(), 'deploylint-gate-'));
	tempDirs.push(dir);
	return dir;
}

async function withScanApi<T>(report: unknown, fn: (apiBase: string) => Promise<T>): Promise<T> {
	const server = createServer((req, res) => {
		if (req.method !== 'POST' || req.url !== '/api/scan') {
			res.writeHead(404);
			res.end('not found');
			return;
		}

		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify(report));
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

async function withSlowScanApi<T>(fn: (apiBase: string) => Promise<T>): Promise<T> {
	const server = createServer((req, res) => {
		if (req.method !== 'POST' || req.url !== '/api/scan') {
			res.writeHead(404);
			res.end('not found');
			return;
		}

		setTimeout(() => {
			if (res.destroyed) return;
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify(failingReport));
		}, 500);
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

function runGate(apiBase: string, { args = [], env = {} }: GateRunOptions = {}) {
	return new Promise<GateRunResult>((resolve, reject) => {
		const child = spawn(process.execPath, [scriptPath, 'https://target.test', ...args], {
			cwd: appRoot,
			env: {
				...process.env,
				DEPLOYLINT_API: apiBase,
				DEPLOYLINT_MODE: 'advisory',
				GITHUB_TOKEN: '',
				GITHUB_REPOSITORY: '',
				GITHUB_EVENT_PATH: '',
				GITHUB_EVENT_NAME: '',
				...env
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

describe('gate-remote advisory output', () => {
	it('prints advisory findings without blocking labels', async () => {
		await withScanApi(failingReport, async (apiBase) => {
			const dir = makeTempDir();
			const summaryPath = join(dir, 'summary.md');
			const result = await runGate(apiBase, {
				env: {
					GITHUB_STEP_SUMMARY: summaryPath
				}
			});

			expect(result.code).toBe(0);
			expect(result.stdout).toContain('Deploylint advisory: ADVISORY');
			expect(result.stdout).toContain('Advisory findings:');
			expect(result.stdout).toContain('Advisory mode');
			expect(result.stdout).not.toContain('Deploylint advisory: FAIL');

			const summary = readFileSync(summaryPath, 'utf8');
			expect(summary).toContain('**Advisory findings:**');
			expect(summary).not.toContain('**Blocking:**');
		});
	});

	it('emits effective pass and raw gatePass in advisory JSON', async () => {
		await withScanApi(failingReport, async (apiBase) => {
			const result = await runGate(apiBase, { args: ['--json'] });
			const jsonLine = result.stdout
				.trim()
				.split(/\r?\n/)
				.findLast((line) => line.startsWith('{'));
			expect(jsonLine).toBeTruthy();
			const payload = JSON.parse(jsonLine ?? '{}') as {
				pass?: boolean;
				gatePass?: boolean;
				advisory?: boolean;
				reasons?: string[];
			};

			expect(result.code).toBe(0);
			expect(payload.pass).toBe(true);
			expect(payload.gatePass).toBe(false);
			expect(payload.advisory).toBe(true);
			expect(payload.reasons).toContain('Score 40 is below minimum 80');
		});
	});

	it('fails quickly with a useful timeout message when the scan API hangs', async () => {
		await withSlowScanApi(async (apiBase) => {
			const result = await runGate(apiBase, {
				env: {
					DEPLOYLINT_FETCH_TIMEOUT_MS: '25',
					DEPLOYLINT_FETCH_RETRIES: '0'
				}
			});

			expect(result.code).toBe(2);
			expect(result.stderr).toContain('Timed out after 25ms while POST');
			expect(result.stderr).toContain('/api/scan');
		});
	});
});

describe('gate-remote blocking output', () => {
	it('blocks failing reports in gate mode and writes blocking summary copy', async () => {
		await withScanApi(failingReport, async (apiBase) => {
			const dir = makeTempDir();
			const summaryPath = join(dir, 'summary.md');
			const result = await runGate(apiBase, {
				env: {
					DEPLOYLINT_MODE: 'gate',
					GITHUB_STEP_SUMMARY: summaryPath
				}
			});

			expect(result.code).toBe(1);
			expect(result.stdout).toContain('Deploylint gate: FAIL');
			expect(result.stdout).toContain('Failures:');
			expect(result.stdout).toContain('P0 blocker: Privacy policy');
			expect(result.stdout).not.toContain('Advisory mode');

			const summary = readFileSync(summaryPath, 'utf8');
			expect(summary).toContain('**Blocking:**');
			expect(summary).not.toContain('**Advisory findings:**');
		});
	});

	it('emits failing effective pass and raw gatePass in gate JSON', async () => {
		await withScanApi(failingReport, async (apiBase) => {
			const result = await runGate(apiBase, {
				args: ['--json'],
				env: {
					DEPLOYLINT_MODE: 'gate'
				}
			});
			const jsonLine = result.stdout
				.trim()
				.split(/\r?\n/)
				.findLast((line) => line.startsWith('{'));
			expect(jsonLine).toBeTruthy();
			const payload = JSON.parse(jsonLine ?? '{}') as {
				pass?: boolean;
				gatePass?: boolean;
				advisory?: boolean;
				reasons?: string[];
			};

			expect(result.code).toBe(1);
			expect(payload.pass).toBe(false);
			expect(payload.gatePass).toBe(false);
			expect(payload.advisory).toBe(false);
			expect(payload.reasons).toContain('Score 40 is below minimum 80');
		});
	});

	it('passes healthy reports in gate mode', async () => {
		await withScanApi(passingReport, async (apiBase) => {
			const result = await runGate(apiBase, {
				env: {
					DEPLOYLINT_MODE: 'gate'
				}
			});

			expect(result.code).toBe(0);
			expect(result.stdout).toContain('Deploylint gate: PASS');
			expect(result.stdout).not.toContain('Failures:');
		});
	});
});
