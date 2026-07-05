import { execSync } from 'node:child_process';
import { renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(root, '..');
const skWorker = path.join(appRoot, '.svelte-kit/cloudflare/_worker.js');
const skWorkerRenamed = path.join(appRoot, '.svelte-kit/cloudflare/_worker.sk.js');
const outWorker = path.join(appRoot, '.svelte-kit/cloudflare/_worker.js');

renameSync(skWorker, skWorkerRenamed);

execSync(
	[
		'npx esbuild ./scripts/worker-wrapper.ts',
		`--outfile=${outWorker}`,
		'--bundle',
		'--format=esm',
		'--platform=neutral',
		'--external:cloudflare:workers',
		'--external:../.svelte-kit/cloudflare/_worker.sk.js'
	].join(' '),
	{ cwd: appRoot, stdio: 'inherit' }
);
