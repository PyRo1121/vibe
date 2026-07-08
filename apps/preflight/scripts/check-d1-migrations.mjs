#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const preflightRoot = fileURLToPath(new URL('..', import.meta.url));
const migrationsDir = join(preflightRoot, 'migrations');
const tempDir = mkdtempSync(join(tmpdir(), 'deploylint-d1-migrations-'));
const wranglerConfigPath = join(tempDir, 'wrangler.jsonc');
const wranglerBin = join(preflightRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

try {
	cpSync(migrationsDir, join(tempDir, 'migrations'), { recursive: true });
	writeFileSync(join(tempDir, 'noop.js'), 'export default {};\n');
	writeFileSync(
		wranglerConfigPath,
		JSON.stringify(
			{
				name: 'deploylint-d1-migration-check',
				main: 'noop.js',
				compatibility_date: '2026-07-05',
				d1_databases: [
					{
						binding: 'AUTH_DB',
						database_name: 'preflight-auth',
						database_id: '51cd2edd-5356-4ff8-a185-a920fdf13ad5',
						migrations_dir: 'migrations'
					}
				]
			},
			null,
			2
		)
	);

	const result = spawnSync(
		process.execPath,
		[
			wranglerBin,
			'd1',
			'migrations',
			'apply',
			'preflight-auth',
			'--local',
			'--config',
			wranglerConfigPath
		],
		{
			cwd: tempDir,
			env: { ...process.env, NO_D1_WARNING: 'true' },
			stdio: 'inherit'
		}
	);

	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
	console.log('ok D1 migrations apply cleanly in an isolated local database');
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}
