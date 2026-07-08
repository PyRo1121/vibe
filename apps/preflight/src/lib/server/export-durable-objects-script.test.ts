import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const scriptPath = fileURLToPath(
	new URL('../../../scripts/export-durable-objects.mjs', import.meta.url)
);
const marker = '// DEPLOYLINT_DURABLE_OBJECT_EXPORTS';
const exportLine = "export { CounterLimiter } from './counter-limiter.js';";

function makeBuildDir(): string {
	const cwd = mkdtempSync(join(tmpdir(), 'deploylint-export-'));
	mkdirSync(join(cwd, '.svelte-kit/cloudflare'), { recursive: true });
	return cwd;
}

function cleanup(cwd: string): void {
	rmSync(cwd, { recursive: true, force: true });
}

function workerPath(cwd: string): string {
	return join(cwd, '.svelte-kit/cloudflare/_worker.js');
}

function limiterPath(cwd: string): string {
	return join(cwd, '.svelte-kit/cloudflare/counter-limiter.js');
}

function runExporter(cwd: string) {
	return spawnSync(process.execPath, [scriptPath], { cwd, encoding: 'utf8' });
}

describe('export-durable-objects script', () => {
	it('writes and verifies the CounterLimiter sidecar export idempotently', () => {
		const cwd = makeBuildDir();
		try {
			writeFileSync(workerPath(cwd), 'export default {};');

			const first = runExporter(cwd);
			expect(first.status).toBe(0);

			const worker = readFileSync(workerPath(cwd), 'utf8');
			expect(worker).toContain(marker);
			expect(worker).toContain(exportLine);
			expect(existsSync(limiterPath(cwd))).toBe(true);
			expect(readFileSync(limiterPath(cwd), 'utf8')).toContain('extends DurableObject');

			const second = runExporter(cwd);
			expect(second.status).toBe(0);
			expect(readFileSync(workerPath(cwd), 'utf8')).toBe(worker);
		} finally {
			cleanup(cwd);
		}
	});

	it('fails when the Cloudflare worker bundle is missing', () => {
		const cwd = makeBuildDir();
		try {
			const result = runExporter(cwd);

			expect(result.status).toBe(1);
			expect(result.stderr).toContain('Cloudflare worker bundle not found');
		} finally {
			cleanup(cwd);
		}
	});

	it('fails when a marked worker is missing the sidecar', () => {
		const cwd = makeBuildDir();
		try {
			writeFileSync(workerPath(cwd), `export default {};\n${marker}\n${exportLine}\n`);

			const result = runExporter(cwd);

			expect(result.status).toBe(1);
			expect(result.stderr).toContain('CounterLimiter sidecar missing');
		} finally {
			cleanup(cwd);
		}
	});

	it('fails when a marked sidecar is not a Durable Object', () => {
		const cwd = makeBuildDir();
		try {
			writeFileSync(workerPath(cwd), `export default {};\n${marker}\n${exportLine}\n`);
			writeFileSync(limiterPath(cwd), 'export class CounterLimiter {}');

			const result = runExporter(cwd);

			expect(result.status).toBe(1);
			expect(result.stderr).toContain(
				'CounterLimiter sidecar must extend Cloudflare DurableObject'
			);
		} finally {
			cleanup(cwd);
		}
	});
});
