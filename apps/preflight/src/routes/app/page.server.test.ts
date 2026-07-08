import { describe, expect, it } from 'vitest';

import { actions, load } from './+page.server';

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

const user = {
	id: 'user_123',
	name: 'Olen',
	email: 'olen@example.com',
	emailVerified: true,
	image: null,
	createdAt: new Date('2026-07-07T00:00:00.000Z'),
	updatedAt: new Date('2026-07-07T00:00:00.000Z')
};

const setupProjectRow = {
	id: 'proj_setup-123',
	ingest_token: 'dlint_setup_token',
	name: 'First deploy target',
	deploy_url: 'https://your-app.com',
	repo_label: 'github.com/your-org/your-app',
	workflow_path: '.github/workflows/deploylint.yml',
	install_state: 'not_installed',
	gate_mode: 'advisory',
	min_score: 80
};

function gateActionEvent(db: FakeD1, projectId = 'proj_live-123') {
	return {
		locals: {
			session: null,
			user
		},
		platform: {
			env: {
				AUTH_DB: db as unknown as D1Database,
				PUBLIC_APP_URL: 'https://deploylint.com'
			}
		},
		request: new Request('https://deploylint.com/app?/enableGate', {
			method: 'POST',
			body: new URLSearchParams({ projectId })
		}),
		url: new URL('https://deploylint.com/app')
	} as Parameters<NonNullable<typeof actions.enableGate>>[0];
}

function gateActionEventWithoutDb(projectId = 'proj_live-123') {
	return {
		locals: {
			session: null,
			user
		},
		platform: {
			env: {
				PUBLIC_APP_URL: 'https://deploylint.com'
			}
		},
		request: new Request('https://deploylint.com/app?/enableGate', {
			method: 'POST',
			body: new URLSearchParams({ projectId })
		}),
		url: new URL('https://deploylint.com/app')
	} as Parameters<NonNullable<typeof actions.enableGate>>[0];
}

function anonymousGateActionEvent() {
	return {
		locals: {
			session: null,
			user: null
		},
		platform: {
			env: {
				PUBLIC_APP_URL: 'https://deploylint.com'
			}
		},
		request: new Request('https://deploylint.com/app?/enableGate', {
			method: 'POST',
			body: new URLSearchParams({ projectId: 'proj_live-123' })
		}),
		url: new URL('https://deploylint.com/app')
	} as Parameters<NonNullable<typeof actions.enableGate>>[0];
}

class ThrowingD1 {
	prepare(): {
		bind: () => { first: () => Promise<never> };
	} {
		return {
			bind: () => ({
				first: async () => {
					throw new Error('D1 unavailable');
				}
			})
		};
	}
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
		const db = new FakeD1();
		db.firstRows = [null, null, { count: 0 }];
		db.allRows = [[]];

		const data = await loadApp({
			locals: {
				session: null,
				user
			},
			platform: {
				env: {
					AUTH_DB: db as unknown as D1Database,
					PUBLIC_APP_URL: 'https://deploylint.com'
				}
			} as unknown as App.Platform
		});

		const pageData = data as Exclude<Awaited<ReturnType<typeof load>>, void>;

		expect(pageData.user).toMatchObject({
			id: 'user_123',
			name: 'Olen',
			email: 'olen@example.com'
		});
		expect(pageData.workspace.ownerLabel).toBe("Olen's workspace");
		expect(pageData.workspace.storageStatus).toBe('available');
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
		expect(pageData.advisoryWorkflow).toContain('DEPLOYLINT_PROJECT_ID:');
		expect(pageData.advisoryWorkflow).toContain(
			'DEPLOYLINT_INGEST_TOKEN: ${{ secrets.DEPLOYLINT_INGEST_TOKEN }}'
		);
		expect(pageData.advisoryWorkflow).not.toContain('proj_demo_123');
		expect(pageData.advisoryWorkflow).not.toContain(pageData.workspace.projects[0].ingestToken);
	});

	it('does not generate a fake project workflow when workspace storage is missing', async () => {
		const data = await loadApp({
			locals: {
				session: null,
				user
			}
		});

		const pageData = data as Exclude<Awaited<ReturnType<typeof load>>, void>;

		expect(pageData.workspace).toMatchObject({
			id: 'workspace_unavailable',
			storageStatus: 'unavailable',
			projects: [],
			metrics: { activeProjects: 0, gatesEnabled: 0, reportsThisMonth: 0 }
		});
		expect(pageData.activation.nextAction).toMatchObject({
			id: 'project',
			ctaLabel: 'Review project'
		});
		expect(pageData.activation.progress).toEqual({
			completed: 0,
			total: 4,
			percentage: 0
		});
		expect(pageData.gatePolicy).toBeNull();
		expect(pageData.advisoryWorkflow).toBe('');
	});

	it('uses project setup query params as the workspace draft', async () => {
		const db = new FakeD1();
		db.firstRows = [null, null, { count: 0 }];
		db.allRows = [[]];

		const data = await loadApp({
			locals: {
				session: null,
				user
			},
			platform: {
				env: {
					AUTH_DB: db as unknown as D1Database,
					PUBLIC_APP_URL: 'https://deploylint.com'
				}
			} as unknown as App.Platform,
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

	it('updates an existing setup project from workspace draft query params', async () => {
		const db = new FakeD1();
		db.firstRows = [{ id: 'wks_live', name: 'Olen workspace' }, null, { count: 0 }];
		db.allRows = [[setupProjectRow], []];

		const data = await loadApp({
			locals: {
				session: null,
				user
			},
			platform: {
				env: {
					AUTH_DB: db as unknown as D1Database,
					PUBLIC_APP_URL: 'https://deploylint.com'
				}
			} as unknown as App.Platform,
			url: new URL(
				'https://deploylint.com/app?name=Acme&repo=https%3A%2F%2Fgithub.com%2Facme%2Fapp&deploy=https%3A%2F%2Fapp.acme.com%2F&minScore=92'
			)
		});

		const pageData = data as Exclude<Awaited<ReturnType<typeof load>>, void>;

		expect(pageData.workspace.projects[0]).toMatchObject({
			id: 'proj_setup-123',
			name: 'Acme',
			repoLabel: 'github.com/acme/app',
			deployUrl: 'https://app.acme.com',
			minScore: 92
		});
		expect(pageData.projectDraftApplied).toBe(true);
		expect(pageData.advisoryWorkflow).toContain('DEPLOYLINT_URL: https://app.acme.com');
		expect(
			db.calls.some((call) => call.method === 'run' && call.sql.includes('UPDATE project'))
		).toBe(true);
	});

	it('does not report draft applied when an installed project keeps its existing target', async () => {
		const db = new FakeD1();
		db.firstRows = [{ id: 'wks_live', name: 'Olen workspace' }, null, { count: 0 }];
		db.allRows = [
			[
				{
					...setupProjectRow,
					name: 'Installed deploy gate',
					deploy_url: 'https://installed.example.com',
					repo_label: 'github.com/acme/installed',
					install_state: 'advisory_installed',
					min_score: 88
				}
			],
			[]
		];

		const data = await loadApp({
			locals: {
				session: null,
				user
			},
			platform: {
				env: {
					AUTH_DB: db as unknown as D1Database,
					PUBLIC_APP_URL: 'https://deploylint.com'
				}
			} as unknown as App.Platform,
			url: new URL(
				'https://deploylint.com/app?name=Acme&repo=https%3A%2F%2Fgithub.com%2Facme%2Fapp&deploy=https%3A%2F%2Fapp.acme.com%2F&minScore=92'
			)
		});

		const pageData = data as Exclude<Awaited<ReturnType<typeof load>>, void>;

		expect(pageData.workspace.projects[0]).toMatchObject({
			name: 'Installed deploy gate',
			repoLabel: 'github.com/acme/installed',
			deployUrl: 'https://installed.example.com',
			minScore: 88
		});
		expect(pageData.projectDraftApplied).toBe(false);
		expect(
			db.calls.some((call) => call.method === 'run' && call.sql.includes('UPDATE project'))
		).toBe(false);
	});

	it('normalizes checkout return status query params for dashboard notices', async () => {
		const success = (await loadApp({
			locals: { session: null, user },
			url: new URL('https://deploylint.com/app?checkout=success')
		})) as Exclude<Awaited<ReturnType<typeof load>>, void>;
		const cancel = (await loadApp({
			locals: { session: null, user },
			url: new URL('https://deploylint.com/app?checkout=cancel')
		})) as Exclude<Awaited<ReturnType<typeof load>>, void>;
		const ignored = (await loadApp({
			locals: { session: null, user },
			url: new URL('https://deploylint.com/app?checkout=unexpected')
		})) as Exclude<Awaited<ReturnType<typeof load>>, void>;

		expect(success.checkoutStatus).toBe('success');
		expect(cancel.checkoutStatus).toBe('cancel');
		expect(ignored.checkoutStatus).toBeNull();
	});

	it('hydrates real D1 workspace report history for authenticated users', async () => {
		const db = new FakeD1();
		db.firstRows = [
			{ id: 'wks_live', name: 'Olen workspace' },
			{ plan: 'builder', status: 'active' },
			{ count: 6 }
		];
		db.allRows = [
			[
				{
					id: 'proj_live-123',
					ingest_token: 'dlint_live_token',
					name: 'Acme deploy gate',
					deploy_url: 'https://app.acme.com',
					repo_label: 'github.com/acme/app',
					workflow_path: '.github/workflows/deploylint.yml',
					install_state: 'advisory_installed',
					gate_mode: 'advisory',
					min_score: 88
				}
			],
			[
				{
					id: 'prpt_latest',
					report_id: 'abc123def456',
					score: 91,
					verdict: 'go',
					scanned_at: '2026-07-08T12:30:00.000Z',
					fixed_count: 3,
					regressed_count: 0,
					final_url: 'https://app.acme.com/',
					commit_sha: 'abc123456789',
					branch: 'main',
					pull_request: '42'
				},
				{
					id: 'prpt_previous',
					report_id: 'older123',
					score: 86,
					verdict: 'conditional',
					scanned_at: '2026-07-08T11:30:00.000Z',
					fixed_count: 1,
					regressed_count: 2,
					final_url: 'https://app.acme.com/',
					commit_sha: 'def987654321',
					branch: 'feature/readiness',
					pull_request: '41'
				}
			]
		];

		const data = await loadApp({
			locals: {
				session: null,
				user
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
			},
			reportHistory: [
				expect.objectContaining({
					id: 'prpt_latest',
					reportId: 'abc123def456',
					finalUrl: 'https://app.acme.com/',
					branch: 'main',
					pullRequest: '42'
				}),
				expect.objectContaining({
					id: 'prpt_previous',
					reportId: 'older123',
					score: 86,
					branch: 'feature/readiness'
				})
			]
		});
		expect(pageData.workspace.metrics.reportsThisMonth).toBe(6);
		expect(pageData.advisoryWorkflow).toContain('DEPLOYLINT_PROJECT_ID: proj_live-123');
	});

	it('enables blocking gate mode for a ready owned project', async () => {
		const db = new FakeD1();
		db.firstRows = [
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
		];
		db.allRows = [
			[
				{
					id: 'prpt_latest',
					report_id: 'abc123def456',
					score: 91,
					verdict: 'go',
					scanned_at: '2026-07-08T12:30:00.000Z',
					fixed_count: 3,
					regressed_count: 0,
					final_url: 'https://app.acme.com/',
					commit_sha: 'abc123456789',
					branch: 'main',
					pull_request: '42'
				}
			]
		];

		await expect(actions.enableGate?.(gateActionEvent(db))).resolves.toEqual({
			gateEnabled: true
		});
		expect(db.calls.at(-1)).toMatchObject({
			method: 'run',
			sql: expect.stringContaining("gate_mode = 'gate'")
		});
	});

	it('returns a form error when gate promotion is not ready', async () => {
		const db = new FakeD1();
		db.firstRows = [
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
		];
		db.allRows = [[]];

		await expect(actions.enableGate?.(gateActionEvent(db))).resolves.toMatchObject({
			status: 400,
			data: {
				enableGateError: expect.stringContaining('Run a clean advisory report')
			}
		});
		expect(db.calls.some((call) => call.method === 'run')).toBe(false);
	});

	it('redirects anonymous gate promotion attempts to login', async () => {
		await expect(actions.enableGate?.(anonymousGateActionEvent())).rejects.toMatchObject({
			status: 303,
			location: '/login?redirectTo=%2Fapp'
		});
	});

	it('returns a form error when gate storage is unavailable', async () => {
		await expect(actions.enableGate?.(gateActionEventWithoutDb())).resolves.toMatchObject({
			status: 400,
			data: {
				enableGateError: 'Workspace storage is not available in this environment.'
			}
		});
	});

	it('returns a form error when gate promotion receives an invalid project id', async () => {
		const db = new FakeD1();

		await expect(actions.enableGate?.(gateActionEvent(db, ''))).resolves.toMatchObject({
			status: 400,
			data: {
				enableGateError: 'Select a valid project before enabling gate mode.'
			}
		});
		expect(db.calls).toEqual([]);
	});

	it('returns a form error when gate promotion cannot find the owned project', async () => {
		const db = new FakeD1();
		db.firstRows = [null];

		await expect(actions.enableGate?.(gateActionEvent(db))).resolves.toMatchObject({
			status: 400,
			data: {
				enableGateError: 'This project was not found in your workspace.'
			}
		});
		expect(db.calls.some((call) => call.method === 'run')).toBe(false);
	});

	it('returns a form error when gate promotion storage throws', async () => {
		await expect(
			actions.enableGate?.(gateActionEvent(new ThrowingD1() as unknown as FakeD1, 'proj_live-123'))
		).resolves.toMatchObject({
			status: 400,
			data: {
				enableGateError:
					'Gate mode could not be enabled right now. Try again after refreshing the workspace.'
			}
		});
	});
});
