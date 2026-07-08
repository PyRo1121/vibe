import { describe, expect, it } from 'vitest';

import { load } from './+page.server';

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

async function loadApp(overrides: Partial<Parameters<typeof load>[0]> = {}) {
	return await load({
		locals: { session: null, user: null },
		platform: { env: { PUBLIC_APP_URL: 'https://deploylint.com' } },
		url: new URL('https://deploylint.com/app'),
		...overrides
	} as Parameters<typeof load>[0]);
}

describe('/app server load', () => {
	it('redirects anonymous users to login', async () => {
		await expect(loadApp()).rejects.toMatchObject({
			status: 303,
			location: '/login?redirectTo=%2Fapp'
		});
	});

	it('preserves workspace draft query params through login redirect', async () => {
		await expect(
			loadApp({
				url: new URL(
					'https://deploylint.com/app?name=Acme&repo=github.com%2Facme%2Fapp&deploy=https%3A%2F%2Fapp.acme.com'
				)
			})
		).rejects.toMatchObject({
			status: 303,
			location:
				'/login?redirectTo=%2Fapp%3Fname%3DAcme%26repo%3Dgithub.com%252Facme%252Fapp%26deploy%3Dhttps%253A%252F%252Fapp.acme.com'
		});
	});

	it('returns the authenticated user with the workspace data', async () => {
		const data = await loadApp({
			locals: {
				session: null,
				user: {
					id: 'user_123',
					name: 'Olen',
					email: 'olen@example.com',
					emailVerified: true,
					image: null,
					createdAt: new Date('2026-07-07T00:00:00.000Z'),
					updatedAt: new Date('2026-07-07T00:00:00.000Z')
				}
			}
		});

		const pageData = data as Exclude<Awaited<ReturnType<typeof load>>, void>;

		expect(pageData.user).toMatchObject({
			id: 'user_123',
			name: 'Olen',
			email: 'olen@example.com'
		});
		expect(pageData.workspace.ownerLabel).toBe("Olen's workspace");
		expect(pageData.activation.nextAction).toMatchObject({
			id: 'workflow',
			ctaLabel: 'Copy workflow'
		});
		expect(pageData.activation.progress).toEqual({
			completed: 1,
			total: 4,
			percentage: 25
		});
		expect(pageData.gatePolicy).toMatchObject({
			checkName: 'deploylint',
			mode: 'advisory',
			minScore: 80,
			enforcementLabel: 'Advisory only'
		});
	});

	it('uses project setup query params as the workspace draft', async () => {
		const data = await loadApp({
			locals: {
				session: null,
				user: {
					id: 'user_123',
					name: 'Olen',
					email: 'olen@example.com',
					emailVerified: true,
					image: null,
					createdAt: new Date('2026-07-07T00:00:00.000Z'),
					updatedAt: new Date('2026-07-07T00:00:00.000Z')
				}
			},
			url: new URL(
				'https://deploylint.com/app?name=Acme&repo=https%3A%2F%2Fgithub.com%2Facme%2Fapp&deploy=https%3A%2F%2Fapp.acme.com%2F&minScore=92'
			)
		});

		const pageData = data as Exclude<Awaited<ReturnType<typeof load>>, void>;
		const project = pageData.workspace.projects[0];

		expect(project).toMatchObject({
			name: 'Acme',
			repoLabel: 'github.com/acme/app',
			deployUrl: 'https://app.acme.com',
			minScore: 92
		});
		expect(pageData.projectDraftApplied).toBe(true);
		expect(pageData.advisoryWorkflow).toContain('DEPLOYLINT_URL: https://app.acme.com');
		expect(pageData.advisoryWorkflow).toContain("DEPLOYLINT_MIN_SCORE: '92'");
	});

	it('hydrates real D1 workspace report history for authenticated users', async () => {
		const db = new FakeD1();
		db.firstRows = [
			{ id: 'wks_live', name: 'Olen workspace' },
			{
				id: 'prpt_latest',
				score: 91,
				verdict: 'go',
				scanned_at: '2026-07-08T12:30:00.000Z',
				fixed_count: 3,
				regressed_count: 0
			},
			{ plan: 'builder', status: 'active' },
			{ count: 6 }
		];
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
			]
		];

		const data = await loadApp({
			locals: {
				session: null,
				user: {
					id: 'user_123',
					name: 'Olen',
					email: 'olen@example.com',
					emailVerified: true,
					image: null,
					createdAt: new Date('2026-07-07T00:00:00.000Z'),
					updatedAt: new Date('2026-07-07T00:00:00.000Z')
				}
			},
			platform: {
				env: {
					AUTH_DB: db as unknown as D1Database,
					PUBLIC_APP_URL: 'https://deploylint.com'
				}
			} as unknown as App.Platform
		});

		const pageData = data as Exclude<Awaited<ReturnType<typeof load>>, void>;

		expect(pageData.workspace.id).toBe('wks_live');
		expect(pageData.workspace.projects[0]).toMatchObject({
			id: 'proj_live-123',
			latestReport: {
				id: 'prpt_latest',
				score: 91,
				verdict: 'go',
				fixedCount: 3,
				regressedCount: 0
			}
		});
		expect(pageData.workspace.metrics.reportsThisMonth).toBe(6);
		expect(pageData.advisoryWorkflow).toContain('DEPLOYLINT_PROJECT_ID: proj_live-123');
	});
});
