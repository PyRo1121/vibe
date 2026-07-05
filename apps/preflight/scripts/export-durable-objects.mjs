#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const marker = '// DEPLOYLINT_DURABLE_OBJECT_EXPORTS';
const exportLine = "export { CounterLimiter } from './counter-limiter.js';";
const workerPath = join(process.cwd(), '.svelte-kit/cloudflare/_worker.js');
const limiterPath = join(process.cwd(), '.svelte-kit/cloudflare/counter-limiter.js');

if (!existsSync(workerPath)) {
	console.error(`Cloudflare worker bundle not found: ${workerPath}`);
	process.exit(1);
}

const current = readFileSync(workerPath, 'utf8');
if (current.includes(marker)) {
	verifyDurableObjectExport(current);
	process.exit(0);
}

function verifyDurableObjectExport(workerContent) {
	if (!workerContent.includes(marker) || !workerContent.includes(exportLine)) {
		console.error('CounterLimiter export marker missing from Cloudflare worker bundle');
		process.exit(1);
	}
	if (!existsSync(limiterPath)) {
		console.error(`CounterLimiter sidecar missing: ${limiterPath}`);
		process.exit(1);
	}
	const limiter = readFileSync(limiterPath, 'utf8');
	if (!limiter.includes('extends DurableObject')) {
		console.error('CounterLimiter sidecar must extend Cloudflare DurableObject');
		process.exit(1);
	}
}

writeFileSync(
	limiterPath,
	`import { DurableObject } from "cloudflare:workers";

export class CounterLimiter extends DurableObject {
\tconstructor(state, env) {
\t\tsuper(state, env);
\t\tthis.state = state;
\t}

\tasync fetch(request) {
\t\tif (request.method !== "POST") {
\t\t\treturn new Response("Method Not Allowed", { status: 405 });
\t\t}

\t\tconst body = await request.json().catch(() => null);
\t\tif (!body?.key || !Number.isFinite(body.limit) || !Number.isFinite(body.windowMs)) {
\t\t\treturn Response.json({ error: "Invalid limiter request" }, { status: 400 });
\t\t}

\t\tconst now = Date.now();
\t\tconst stored = await this.state.storage.get(body.key);
\t\tconst current =
\t\t\tstored && stored.expiresAt > now ? stored : { count: 0, expiresAt: now + body.windowMs };
\t\tif (current.count >= body.limit) {
\t\t\treturn Response.json({ allowed: false, remaining: 0 });
\t\t}

\t\tconst next = { count: current.count + 1, expiresAt: current.expiresAt };
\t\tawait this.state.storage.put(body.key, next);
\t\treturn Response.json({ allowed: true, remaining: Math.max(0, body.limit - next.count) });
\t}
}
`
);

writeFileSync(workerPath, `${current}\n${marker}\n${exportLine}\n`);

verifyDurableObjectExport(readFileSync(workerPath, 'utf8'));
