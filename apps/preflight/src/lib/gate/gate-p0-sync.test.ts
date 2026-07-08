import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { P0_CHECK_IDS } from '$lib/scan/p0-ids';
import { describe, expect, it } from 'vitest';

const currentDir = import.meta.dirname;
const root = join(currentDir, '..', '..', '..');
const repoRoot = join(root, '..', '..');
const mcpGatePath = join(root, '..', 'preflight-mcp', 'src', 'gate.ts');
const actionPath = join(repoRoot, '.github', 'actions', 'deploylint-gate', 'action.yml');

function extractGateP0Ids(relPath: string): string[] {
	const content = readFileSync(join(root, relPath), 'utf8');
	const match = content.match(/const P0_IDS = new Set\(\[([\s\S]*?)\]\);/);
	if (!match) throw new Error(`P0_IDS block missing in ${relPath}`);
	return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function extractMcpP0Ids(): string[] {
	const content = readFileSync(mcpGatePath, 'utf8');
	const match = content.match(/GATE_P0_IDS = new Set\(\[([\s\S]*?)\]\)/);
	if (!match) throw new Error('GATE_P0_IDS block missing in preflight-mcp');
	return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

describe('gate P0 sync', () => {
	const canonical = [...P0_CHECK_IDS].toSorted();
	const canonicalScript = readFileSync(join(root, 'scripts/gate-remote.mjs'), 'utf8');

	it('scripts/gate-remote.mjs matches verdict P0 list', () => {
		expect(extractGateP0Ids('scripts/gate-remote.mjs').toSorted()).toEqual(canonical);
	});

	it('static/gate-remote.mjs matches verdict P0 list', () => {
		expect(extractGateP0Ids('static/gate-remote.mjs').toSorted()).toEqual(canonical);
	});

	it('preflight-mcp gate.ts matches verdict P0 list', () => {
		expect(extractMcpP0Ids().toSorted()).toEqual(canonical);
	});

	it('vendored GitHub Action gate script matches verdict P0 list', () => {
		expect(
			extractGateP0Ids('../../.github/actions/deploylint-gate/gate-remote.mjs').toSorted()
		).toEqual(canonical);
	});

	it('static and vendored gate scripts match the canonical hosted script', () => {
		expect(readFileSync(join(root, 'static/gate-remote.mjs'), 'utf8')).toBe(canonicalScript);
		expect(
			readFileSync(join(repoRoot, '.github/actions/deploylint-gate/gate-remote.mjs'), 'utf8')
		).toBe(canonicalScript);
	});

	it('GitHub Action runs the vendored script instead of curling live code', () => {
		const action = readFileSync(actionPath, 'utf8');
		expect(action).not.toContain('curl');
		expect(action).toContain('$GITHUB_ACTION_PATH/gate-remote.mjs');
		expect(action).toContain('default: gate');
		expect(action).toContain('DEPLOYLINT_URL');
	});

	it('GitHub Action exposes bounded fetch controls', () => {
		const action = readFileSync(actionPath, 'utf8');
		expect(action).toContain('fetch_timeout_ms:');
		expect(action).toContain('fetch_retries:');
		expect(action).toContain('fetch_retry_delay_ms:');
		expect(action).toContain('DEPLOYLINT_FETCH_TIMEOUT_MS: ${{ inputs.fetch_timeout_ms }}');
		expect(action).toContain('DEPLOYLINT_FETCH_RETRIES: ${{ inputs.fetch_retries }}');
		expect(action).toContain('DEPLOYLINT_FETCH_RETRY_DELAY_MS: ${{ inputs.fetch_retry_delay_ms }}');
	});
});
