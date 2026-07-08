import { afterEach, describe, expect, it, vi } from 'vitest';

import { POST } from './+server';

interface D1Call {
	sql: string;
	values: unknown[];
	method: 'first';
}

class FakeStatement {
	private values: unknown[] = [];

	constructor(
		private readonly db: FakeD1,
		private readonly sql: string
	) {}

	bind(...values: unknown[]): FakeStatement {
		this.values = values;
		return this;
	}

	async first(): Promise<unknown> {
		this.db.calls.push({ sql: this.sql, values: this.values, method: 'first' });
		return this.db.firstRows.shift() ?? null;
	}
}

class FakeD1 {
	calls: D1Call[] = [];
	firstRows: unknown[] = [];

	prepare(sql: string): FakeStatement {
		return new FakeStatement(this, sql);
	}
}

const user = {
	id: 'user_123',
	name: 'Olen',
	email: 'olen@example.com',
	emailVerified: true,
	image: null,
	createdAt: new Date('2026-07-07T00:00:00.000Z'),
	updatedAt: new Date('2026-07-07T00:00:00.000Z')
};

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function portalEvent(db: FakeD1 | null) {
	const env = {
		...(db ? { AUTH_DB: db as unknown as D1Database } : {}),
		PUBLIC_APP_URL: 'https://deploylint.com',
		STRIPE_SECRET_KEY: 'sk_test_x'
	};

	return {
		locals: {
			session: null,
			user
		},
		platform: { env },
		request: new Request('https://deploylint.com/api/workspace/billing/portal', {
			method: 'POST'
		}),
		url: new URL('https://deploylint.com/api/workspace/billing/portal')
	} as Parameters<typeof POST>[0];
}

describe('workspace billing portal route', () => {
	it('redirects anonymous users to login', async () => {
		const event = portalEvent(new FakeD1());
		event.locals.user = null;

		await expect(POST(event)).rejects.toMatchObject({ status: 303 });
	});

	it('fails closed when workspace storage is unavailable', async () => {
		await expect(POST(portalEvent(null))).rejects.toMatchObject({ status: 503 });
	});

	it('redirects paid workspace owners to the Stripe billing portal', async () => {
		const db = new FakeD1();
		db.firstRows = [{ stripe_customer_id: 'cus_workspace', workspace_id: 'wks_live' }];
		vi.stubGlobal(
			'fetch',
			vi.fn(async (_url: string, init?: RequestInit) => {
				const body = init?.body as URLSearchParams;
				expect(body.get('customer')).toBe('cus_workspace');
				expect(body.get('return_url')).toBe('https://deploylint.com/app?billing=return');
				return {
					ok: true,
					json: async () => ({
						id: 'bps_workspace',
						url: 'https://billing.stripe.com/p/workspace'
					})
				};
			})
		);

		await expect(POST(portalEvent(db))).rejects.toMatchObject({
			status: 303,
			location: 'https://billing.stripe.com/p/workspace'
		});
		expect(db.calls).toEqual([
			expect.objectContaining({
				method: 'first',
				values: ['user_123']
			})
		]);
	});

	it('rejects workspaces without an active subscription customer', async () => {
		const db = new FakeD1();
		db.firstRows = [null];

		await expect(POST(portalEvent(db))).rejects.toMatchObject({ status: 400 });
	});

	it('returns 502 when Stripe portal creation fails', async () => {
		const db = new FakeD1();
		db.firstRows = [{ stripe_customer_id: 'cus_workspace', workspace_id: 'wks_live' }];
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: false,
				text: async () => 'portal disabled'
			}))
		);

		await expect(POST(portalEvent(db))).rejects.toMatchObject({ status: 502 });
	});
});
