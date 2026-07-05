/**
 * Launch blockers (P0) — single source of truth for verdict, CI gate, and MCP.
 * Keep `static/gate-remote.mjs` and `apps/preflight-mcp/src/gate.ts` in sync (see gate-p0-sync.test.ts).
 */
export const P0_CHECK_IDS = [
	'reachable',
	'fetch',
	'https',
	'secrets',
	'privacy',
	'noindex',
	'robots-block',
	'env-committed',
	'form-security',
	'dependency-vulns',
	'workflow-pull-request-target',
	'webhook-signature-missing',
	'docker-env-copy',
	'exposed-env',
	'exposed-git',
	'exposed-backup'
] as const;

export type P0CheckId = (typeof P0_CHECK_IDS)[number];

export const P0_ID_SET: ReadonlySet<string> = new Set(P0_CHECK_IDS);
