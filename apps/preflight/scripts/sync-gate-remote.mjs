#!/usr/bin/env node
/**
 * Copies the canonical P0 IDs from src/lib/scan/p0-ids.ts into every
 * zero-install gate surface. Run after changing P0_CHECK_IDS.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const checkMode = process.argv.includes('--check');
let hasDrift = false;

const currentDir = import.meta.dirname;
const root = join(currentDir, '..');

function syncFile(path, content, label) {
	const current = readFileSync(path, 'utf8');
	if (current === content) {
		console.log(`${checkMode ? 'checked' : 'unchanged'} ${label}`);
		return;
	}

	if (checkMode) {
		console.error(`${label} is out of sync. Run npm run sync:gate-remote -w preflight.`);
		hasDrift = true;
		return;
	}

	writeFileSync(path, content);
	console.log(`synced ${label}`);
}

const p0Source = readFileSync(join(root, 'src/lib/scan/p0-ids.ts'), 'utf8');
const match = p0Source.match(/export const P0_CHECK_IDS = \[([\s\S]*?)\] as const/);
if (!match) {
	console.error('Could not parse P0_CHECK_IDS from p0-ids.ts');
	process.exit(1);
}

const ids = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const gateBlock = `const P0_IDS = new Set([\n${ids.map((id) => `\t'${id}'`).join(',\n')}\n]);`;
const mcpBlock = `const GATE_P0_IDS = new Set([\n${ids.map((id) => `\t'${id}'`).join(',\n')}\n]);`;

const canonicalGatePath = join(root, 'scripts/gate-remote.mjs');
let canonicalGate = readFileSync(canonicalGatePath, 'utf8');
if (!/const P0_IDS = new Set\(\[[\s\S]*?\]\);/.test(canonicalGate)) {
	console.error('P0_IDS block not found in scripts/gate-remote.mjs');
	process.exit(1);
}
canonicalGate = canonicalGate.replace(/const P0_IDS = new Set\(\[[\s\S]*?\]\);/, gateBlock);
syncFile(canonicalGatePath, canonicalGate, `scripts/gate-remote.mjs (${ids.length} P0 IDs)`);

const gateCopies = [
	{ rel: 'static/gate-remote.mjs', path: join(root, 'static/gate-remote.mjs') },
	{
		rel: '.github/actions/deploylint-gate/gate-remote.mjs',
		path: join(root, '..', '..', '.github', 'actions', 'deploylint-gate', 'gate-remote.mjs')
	}
];

for (const { rel, path } of gateCopies) {
	syncFile(path, canonicalGate, rel);
}

const mcpPath = join(root, '..', 'preflight-mcp', 'src', 'gate.ts');
let mcpContent = readFileSync(mcpPath, 'utf8');
if (!/(?:export )?const GATE_P0_IDS = new Set\(\[[\s\S]*?\]\);/.test(mcpContent)) {
	console.error('GATE_P0_IDS block not found in preflight-mcp/src/gate.ts');
	process.exit(1);
}
mcpContent = mcpContent.replace(
	/(?:export )?const GATE_P0_IDS = new Set\(\[[\s\S]*?\]\);/,
	mcpBlock
);
syncFile(mcpPath, mcpContent, `preflight-mcp/src/gate.ts (${ids.length} P0 IDs)`);

if (checkMode && hasDrift) process.exit(1);
