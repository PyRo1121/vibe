import worker from '../.svelte-kit/cloudflare/_worker.sk.js';
import { runScheduledSync } from '../src/lib/server/scheduled.ts';

export default {
	fetch: worker.fetch,
	scheduled: async (_event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
		ctx.waitUntil(runScheduledSync(env));
	}
};
