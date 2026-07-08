interface CounterRecord {
	count: number;
	expiresAt: number;
}

interface ReserveRequest {
	key: string;
	limit: number;
	windowMs: number;
}

const DurableObjectFallback: new (state: DurableObjectState, env: Env) => object = Object;
const DurableObjectBase =
	(
		globalThis as typeof globalThis & {
			DurableObject?: new (state: DurableObjectState, env: Env) => object;
		}
	).DurableObject ?? DurableObjectFallback;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isPositiveInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function parseReserveRequest(value: unknown): ReserveRequest | null {
	if (!isRecord(value)) return null;

	const key = value.key;
	const limit = value.limit;
	const windowMs = value.windowMs;
	if (typeof key !== 'string' || key.trim().length === 0) return null;
	if (!isPositiveInteger(limit) || !isPositiveInteger(windowMs)) return null;

	return { key, limit, windowMs };
}

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

		const body = parseReserveRequest(await request.json().catch(() => null));
		if (!body) {
			return Response.json({ error: 'Invalid limiter request' }, { status: 400 });
		}
		const { key, limit, windowMs } = body;

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
