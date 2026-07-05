import { runScheduledSync } from '../src/lib/server/scheduled.ts';
import worker from './_worker.sk.js';

export default {
	fetch: worker.fetch,
	scheduled: async (_event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
		ctx.waitUntil(runScheduledSync(env));
	}
};
