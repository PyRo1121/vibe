interface CounterRecord {
	count: number;
	expiresAt: number;
}

interface ReserveRequest {
	key?: string;
	limit?: number;
	windowMs?: number;
}

const DurableObjectBase =
	(
		globalThis as typeof globalThis & {
			DurableObject?: new (state: DurableObjectState, env: Env) => object;
		}
	).DurableObject ?? (Object as unknown as new (state: DurableObjectState, env: Env) => object);

export class CounterLimiter extends DurableObjectBase {
	private readonly state: DurableObjectState;

	constructor(state: DurableObjectState, env: Env) {
		super(state, env);
		this.state = state;
	}

	async fetch(request: Request): Promise<Response> {
		if (request.method !== 'POST') {
			return new Response('Method Not Allowed', { status: 405 });
		}

		const body = (await request.json().catch(() => null)) as ReserveRequest | null;
		if (!body?.key || !Number.isFinite(body.limit) || !Number.isFinite(body.windowMs)) {
			return Response.json({ error: 'Invalid limiter request' }, { status: 400 });
		}
		const { key, limit, windowMs } = body as { key: string; limit: number; windowMs: number };

		const now = Date.now();
		const stored = await this.state.storage.get<CounterRecord>(key);
		const current =
			stored && stored.expiresAt > now ? stored : { count: 0, expiresAt: now + windowMs };
		if (current.count >= limit) {
			return Response.json({ allowed: false, remaining: 0 });
		}

		const next = { count: current.count + 1, expiresAt: current.expiresAt };
		await this.state.storage.put(key, next);
		return Response.json({ allowed: true, remaining: Math.max(0, limit - next.count) });
	}
}
