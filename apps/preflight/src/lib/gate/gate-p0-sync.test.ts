import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { P0_CHECK_IDS } from '$lib/scan/p0-ids';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..', '..');
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
	const canonical = [...P0_CHECK_IDS].sort();

	it('scripts/gate-remote.mjs matches verdict P0 list', () => {
		expect(extractGateP0Ids('scripts/gate-remote.mjs').sort()).toEqual(canonical);
	});

	it('static/gate-remote.mjs matches verdict P0 list', () => {
		expect(extractGateP0Ids('static/gate-remote.mjs').sort()).toEqual(canonical);
	});

	it('preflight-mcp gate.ts matches verdict P0 list', () => {
		expect(extractMcpP0Ids().sort()).toEqual(canonical);
	});

	it('vendored GitHub Action gate script matches verdict P0 list', () => {
		expect(
			extractGateP0Ids('../../.github/actions/deploylint-gate/gate-remote.mjs').sort()
		).toEqual(canonical);
	});

	it('GitHub Action runs the vendored script instead of curling live code', () => {
		const action = readFileSync(actionPath, 'utf8');
		expect(action).not.toContain('curl');
		expect(action).toContain('$GITHUB_ACTION_PATH/gate-remote.mjs');
	});
});
