import { afterEach, describe, expect, it, vi } from 'vitest';

import { POST } from './+server';

interface D1Call {
	sql: string;
	values: unknown[];
	method: 'all' | 'first' | 'run';
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

	async all(): Promise<{ results: unknown[] }> {
		this.db.calls.push({ sql: this.sql, values: this.values, method: 'all' });
		return { results: this.db.allRows.shift() ?? [] };
	}

	async first(): Promise<unknown> {
		this.db.calls.push({ sql: this.sql, values: this.values, method: 'first' });
		return this.db.firstRows.shift() ?? null;
	}

	async run(): Promise<unknown> {
		this.db.calls.push({ sql: this.sql, values: this.values, method: 'run' });
		return { success: true };
	}
}

class FakeD1 {
	allRows: unknown[][] = [];
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

function seedBillableProject(db: FakeD1): void {
	db.firstRows = [{ id: 'wks_live', name: 'Olen workspace' }, null, { count: 2 }];
	db.allRows = [
		[
			{
				id: 'proj_live-123',
				name: 'Acme deploy gate',
				deploy_url: 'https://app.acme.com',
				repo_label: 'github.com/acme/app',
				workflow_path: '.github/workflows/deploylint.yml',
				install_state: 'advisory_installed',
				gate_mode: 'advisory',
				min_score: 88
			}
		],
		[]
	];
}

function checkoutEvent(
	db: FakeD1 | null,
	plan = 'builder',
	opts: { secretKey?: string; user?: typeof user } = {}
) {
	const env = {
		...(db ? { AUTH_DB: db as unknown as D1Database } : {}),
		PUBLIC_APP_URL: 'https://deploylint.com',
		STRIPE_PRICE_BUILDER: 'price_builder',
		STRIPE_SECRET_KEY: opts.secretKey ?? 'sk_test_x'
	};

	return {
		locals: {
			session: null,
			user: opts.user ?? user
		},
		platform: {
			env
		},
		request: new Request('https://deploylint.com/api/workspace/checkout', {
			method: 'POST',
			body: new URLSearchParams({ plan })
		}),
		url: new URL('https://deploylint.com/api/workspace/checkout')
	} as Parameters<typeof POST>[0];
}

describe('workspace checkout route', () => {
	it('redirects anonymous users to login', async () => {
		const event = checkoutEvent(new FakeD1());
		event.locals.user = null;

		await expect(POST(event)).rejects.toMatchObject({ status: 303 });
	});

	it('fails closed when workspace storage is unavailable', async () => {
		await expect(POST(checkoutEvent(null))).rejects.toMatchObject({ status: 503 });
	});

	it('redirects authenticated workspace checkout to Stripe', async () => {
		const db = new FakeD1();
		seedBillableProject(db);

		vi.stubGlobal(
			'fetch',
			vi.fn(async (_url: string, init?: RequestInit) => {
				const body = init?.body as URLSearchParams;
				expect(body.get('metadata[workspace_id]')).toBe('wks_live');
				expect(body.get('metadata[project_id]')).toBe('proj_live-123');
				expect(body.get('metadata[plan]')).toBe('builder');
				return {
					ok: true,
					json: async () => ({
						id: 'cs_test_workspace',
						url: 'https://checkout.stripe.com/workspace'
					})
				};
			})
		);

		await expect(POST(checkoutEvent(db))).rejects.toMatchObject({
			status: 303,
			location: 'https://checkout.stripe.com/workspace'
		});
	});

	it('returns a bounded 502 when Stripe checkout creation fails', async () => {
		const db = new FakeD1();
		seedBillableProject(db);
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Promise.reject('stripe unavailable'))
		);

		await expect(POST(checkoutEvent(db))).rejects.toMatchObject({ status: 502 });
		expect(errorSpy).toHaveBeenCalledWith(
			'deploylint.workspace_checkout.failed',
			expect.objectContaining({
				message: 'stripe unavailable',
				plan: 'builder',
				priceEnv: 'STRIPE_PRICE_BUILDER',
				stripeMode: 'test'
			})
		);
	});

	it('reports live-mode Stripe checkout failures from Error objects', async () => {
		const db = new FakeD1();
		seedBillableProject(db);
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Promise.reject(new Error('live checkout offline')))
		);
		const liveSecretKey = ['sk', 'live', 'workspace'].join('_');

		await expect(
			POST(checkoutEvent(db, 'builder', { secretKey: liveSecretKey }))
		).rejects.toMatchObject({ status: 502 });
		expect(errorSpy).toHaveBeenCalledWith(
			'deploylint.workspace_checkout.failed',
			expect.objectContaining({
				message: 'live checkout offline',
				stripeMode: 'live'
			})
		);
	});

	it('rejects checkout for placeholder projects', async () => {
		const db = new FakeD1();
		db.firstRows = [{ id: 'wks_live', name: 'Olen workspace' }, null, { count: 0 }];
		db.allRows = [
			[
				{
					id: 'proj_live-123',
					name: 'First deploy target',
					deploy_url: 'https://your-app.com',
					repo_label: 'github.com/your-org/your-app',
					workflow_path: '.github/workflows/deploylint.yml',
					install_state: 'not_installed',
					gate_mode: 'advisory',
					min_score: 80
				}
			],
			[]
		];

		await expect(POST(checkoutEvent(db))).rejects.toMatchObject({ status: 400 });
	});

	it('uses the account email as the workspace label when the profile name is blank', async () => {
		const db = new FakeD1();
		db.firstRows = [null, null, null, { count: 0 }];
		db.allRows = [[]];

		await expect(
			POST(
				checkoutEvent(db, 'builder', {
					user: { ...user, name: '' }
				})
			)
		).rejects.toMatchObject({ status: 400 });
		expect(db.calls).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					method: 'run',
					sql: expect.stringContaining('INSERT INTO workspace'),
					values: [
						expect.stringMatching(/^wks_[a-z0-9]{16}$/),
						user.id,
						`${user.email}'s workspace`,
						expect.any(Number),
						expect.any(Number)
					]
				})
			])
		);
	});
});
