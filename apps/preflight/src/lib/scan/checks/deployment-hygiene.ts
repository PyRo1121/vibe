import type { CheckCtx } from '$lib/scan/checks/helpers';
import type { PageMeta } from '$lib/scan/parse';
import type { DebugSignals, ExposedPathResult, HealthEndpointResult } from '$lib/scan/probes';
import { fixPrompt } from '$lib/scan/prompts';
import { makeCheck } from '$lib/scan/score';
import type { ScanCheck } from '$lib/scan/types';

export function pushDeploymentHygieneChecks(
	checks: ScanCheck[],
	html: string,
	meta: PageMeta,
	exposed: ExposedPathResult,
	health: HealthEndpointResult,
	debugSignals: DebugSignals,
	ctx: CheckCtx
): void {
	checks.push(
		makeCheck(
			'exposed-env',
			'security',
			'Exposed .env file',
			exposed.env.exposed ? 'fail' : 'pass',
			exposed.env.exposed
				? `/.env is publicly reachable${exposed.env.url ? ` at ${exposed.env.url}` : ''}`
				: 'No publicly reachable .env file detected',
			fixPrompt('exposed-env', ctx)
		),
		makeCheck(
			'exposed-git',
			'security',
			'Exposed .git directory',
			exposed.git.exposed ? 'fail' : 'pass',
			exposed.git.exposed
				? `/.git/HEAD is publicly reachable${exposed.git.url ? ` at ${exposed.git.url}` : ''}`
				: 'No publicly reachable .git metadata detected',
			fixPrompt('exposed-git', ctx)
		),
		makeCheck(
			'exposed-backup',
			'security',
			'Exposed backup artifact',
			exposed.backup.exposed ? 'fail' : 'pass',
			exposed.backup.exposed
				? `Backup or env snapshot is publicly reachable${exposed.backup.url ? ` at ${exposed.backup.url}` : ''}`
				: 'No backup.zip or .env.bak exposed at common paths',
			fixPrompt('exposed-backup', ctx)
		),
		makeCheck(
			'exposed-package',
			'security',
			'Exposed package.json',
			exposed.packageJson.exposed ? 'warn' : 'pass',
			exposed.packageJson.exposed
				? `Root package.json is publicly downloadable${exposed.packageJson.url ? ` at ${exposed.packageJson.url}` : ''}`
				: 'package.json not exposed at site root',
			fixPrompt('exposed-package', ctx)
		)
	);

	const saasLike =
		meta.stack.stripe ||
		meta.stack.paddle ||
		meta.stack.lemonSqueezy ||
		meta.stack.supabase ||
		meta.stack.firebase ||
		meta.stack.clerk ||
		meta.stack.auth0 ||
		meta.stack.workos ||
		meta.stack.openai ||
		meta.stack.anthropic ||
		meta.stack.replicate ||
		meta.stack.huggingFace;
	if (saasLike) {
		checks.push(
			makeCheck(
				'health-endpoint',
				'launch',
				'Health endpoint',
				health.found ? 'pass' : 'warn',
				health.found
					? `Health check responds at ${health.path ?? 'a common path'}`
					: 'No /health, /healthz, /api/health, or /status endpoint found — add one for uptime monitoring',
				fixPrompt('health-endpoint', ctx)
			)
		);
	}

	const hasManifestLink = /<link[^>]+rel=["']manifest["']/i.test(html);
	checks.push(
		makeCheck(
			'web-manifest',
			'launch',
			'Web app manifest',
			hasManifestLink ? 'pass' : 'warn',
			hasManifestLink
				? 'manifest link present in HTML'
				: 'No <link rel="manifest"> — add manifest.webmanifest for PWA polish',
			fixPrompt('web-manifest', ctx)
		)
	);

	const noisyDebug =
		debugSignals.debuggerCount > 0 ||
		debugSignals.consoleLogCount >= 3 ||
		debugSignals.testIdCount >= 5;
	checks.push(
		makeCheck(
			'debug-in-bundle',
			'launch',
			'Production debug noise',
			noisyDebug ? 'warn' : 'pass',
			noisyDebug
				? `Found ${debugSignals.consoleLogCount} console.log, ${debugSignals.debuggerCount} debugger, ${debugSignals.testIdCount} data-testid in sampled JS`
				: 'No obvious debug noise in sampled production bundles',
			fixPrompt('debug-in-bundle', ctx)
		)
	);
}
