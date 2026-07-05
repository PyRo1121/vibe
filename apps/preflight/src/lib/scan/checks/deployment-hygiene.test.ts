import type { PageMeta } from '$lib/scan/parse';
import { parsePageMeta } from '$lib/scan/parse';
import type { ScanCheck } from '$lib/scan/types';
import { describe, it, expect } from 'vitest';

import { pushDeploymentHygieneChecks } from './deployment-hygiene';

const ctx = { url: 'https://app.example.com' };

const saasMeta = {
	stack: { stripe: true, supabase: false, firebase: false }
} as PageMeta;

describe('pushDeploymentHygieneChecks', () => {
	it('fails on exposed env and git', () => {
		const checks: ScanCheck[] = [];
		pushDeploymentHygieneChecks(
			checks,
			'<html></html>',
			saasMeta,
			{
				env: { exposed: true, url: 'https://app.example.com/.env' },
				git: { exposed: true, url: 'https://app.example.com/.git/HEAD' },
				backup: { exposed: false },
				packageJson: { exposed: false }
			},
			{ found: false },
			{ consoleLogCount: 0, debuggerCount: 0, testIdCount: 0 },
			ctx
		);
		expect(checks.find((c) => c.id === 'exposed-env')?.status).toBe('fail');
		expect(checks.find((c) => c.id === 'exposed-git')?.status).toBe('fail');
		expect(checks.find((c) => c.id === 'health-endpoint')?.status).toBe('warn');
	});

	it('passes when nothing exposed and health found', () => {
		const checks: ScanCheck[] = [];
		pushDeploymentHygieneChecks(
			checks,
			'<html><link rel="manifest" href="/manifest.webmanifest"></html>',
			saasMeta,
			{
				env: { exposed: false },
				git: { exposed: false },
				backup: { exposed: false },
				packageJson: { exposed: false }
			},
			{ found: true, path: '/health' },
			{ consoleLogCount: 0, debuggerCount: 0, testIdCount: 0 },
			ctx
		);
		expect(checks.find((c) => c.id === 'exposed-env')?.status).toBe('pass');
		expect(checks.find((c) => c.id === 'health-endpoint')?.status).toBe('pass');
		expect(checks.find((c) => c.id === 'web-manifest')?.status).toBe('pass');
	});

	it('flags exposed-backup, exposed-package, and debug-in-bundle hygiene signals', () => {
		const checks: ScanCheck[] = [];
		pushDeploymentHygieneChecks(
			checks,
			'<html></html>',
			saasMeta,
			{
				env: { exposed: false },
				git: { exposed: false },
				backup: { exposed: true, url: 'https://app.example.com/backup.zip' },
				packageJson: { exposed: true, url: 'https://app.example.com/package.json' }
			},
			{ found: false },
			{ consoleLogCount: 3, debuggerCount: 1, testIdCount: 5 },
			ctx
		);

		expect(checks.find((c) => c.id === 'exposed-backup')?.status).toBe('fail');
		expect(checks.find((c) => c.id === 'exposed-package')?.status).toBe('warn');
		expect(checks.find((c) => c.id === 'debug-in-bundle')?.status).toBe('warn');
	});

	it('expects a health endpoint for auth-backed apps', () => {
		const checks: ScanCheck[] = [];
		pushDeploymentHygieneChecks(
			checks,
			'<script src="https://js.clerk.com/v4/clerk.browser.js"></script>',
			parsePageMeta(
				'<script src="https://js.clerk.com/v4/clerk.browser.js"></script>',
				new URL(ctx.url)
			),
			{
				env: { exposed: false },
				git: { exposed: false },
				backup: { exposed: false },
				packageJson: { exposed: false }
			},
			{ found: false },
			{ consoleLogCount: 0, debuggerCount: 0, testIdCount: 0 },
			ctx
		);

		expect(checks.find((c) => c.id === 'health-endpoint')?.status).toBe('warn');
	});
});
