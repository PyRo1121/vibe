import { describe, expect, it } from 'vitest';

import { loadOrCreateWorkspaceState } from './workspace-store';

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

const projectRow = {
	id: 'proj_live-123',
	name: 'Acme deploy gate',
	deploy_url: 'https://app.acme.com',
	repo_label: 'github.com/acme/app',
	workflow_path: '.github/workflows/deploylint.yml',
	install_state: 'advisory_installed',
	gate_mode: 'advisory',
	min_score: 88
};

describe('workspace D1 store', () => {
	it('hydrates workspace, subscription, project, metrics, and latest report from D1', async () => {
		const db = new FakeD1();
		db.firstRows = [
			{
				id: 'wks_live',
				name: 'Acme workspace'
			},
			{
				plan: 'builder',
				status: 'active'
			},
			{ count: 4 }
		];
		db.allRows = [
			[projectRow],
			[
				{
					id: 'prpt_latest',
					report_id: 'abc123def456',
					score: 91,
					verdict: 'go',
					scanned_at: '2026-07-08T12:30:00.000Z',
					fixed_count: 2,
					regressed_count: 0,
					final_url: 'https://app.acme.com/',
					commit_sha: 'abc123456789',
					branch: 'main',
					pull_request: '42'
				}
			]
		];

		const workspace = await loadOrCreateWorkspaceState(db as unknown as D1Database, {
			alphaFreeUnlock: false,
			ownerLabel: "Olen's workspace",
			ownerUserId: 'user_123'
		});

		expect(workspace).toMatchObject({
			id: 'wks_live',
			ownerLabel: 'Acme workspace',
			billing: {
				mode: 'paid',
				planLabel: 'Builder',
				projectLimit: 5
			},
			metrics: {
				activeProjects: 1,
				gatesEnabled: 0,
				reportsThisMonth: 4
			}
		});
		expect(workspace.projects[0]).toMatchObject({
			id: 'proj_live-123',
			name: 'Acme deploy gate',
			deployUrl: 'https://app.acme.com',
			latestReport: {
				id: 'prpt_latest',
				score: 91,
				verdict: 'go',
				scannedAt: '2026-07-08T12:30:00.000Z',
				fixedCount: 2,
				regressedCount: 0
			},
			reportHistory: [
				{
					id: 'prpt_latest',
					reportId: 'abc123def456',
					score: 91,
					verdict: 'go',
					scannedAt: '2026-07-08T12:30:00.000Z',
					fixedCount: 2,
					regressedCount: 0,
					finalUrl: 'https://app.acme.com/',
					commitSha: 'abc123456789',
					branch: 'main',
					pullRequest: '42'
				}
			]
		});
	});

	it('creates real workspace and project rows for a first authenticated visit', async () => {
		const db = new FakeD1();
		db.firstRows = [null, null, null, { count: 0 }];
		db.allRows = [[]];

		const workspace = await loadOrCreateWorkspaceState(db as unknown as D1Database, {
			alphaFreeUnlock: true,
			ownerLabel: "Olen's workspace",
			ownerUserId: 'user_123',
			projectDraft: {
				name: 'Acme launch',
				deployUrl: 'https://app.acme.com',
				repoLabel: 'github.com/acme/app',
				minScore: 92
			}
		});

		expect(workspace.id).toMatch(/^wks_[a-z0-9]{16}$/);
		expect(workspace.id).not.toBe('workspace_demo');
		expect(workspace.projects[0]).toMatchObject({
			id: expect.stringMatching(/^proj_[a-z0-9]{16}$/),
			name: 'Acme launch',
			deployUrl: 'https://app.acme.com',
			repoLabel: 'github.com/acme/app',
			minScore: 92,
			latestReport: null,
			reportHistory: []
		});
		expect(workspace.projects[0].id).not.toBe('proj_demo_123');
		expect(db.calls.filter((call) => call.method === 'run').map((call) => call.sql)).toEqual([
			expect.stringContaining('INSERT INTO workspace'),
			expect.stringContaining('INSERT INTO project')
		]);
	});

	it('only counts installed blocking gates as enabled', async () => {
		const db = new FakeD1();
		db.firstRows = [
			{
				id: 'wks_live',
				name: 'Acme workspace'
			},
			null,
			null,
			{ count: 0 }
		];
		db.allRows = [
			[
				{
					...projectRow,
					install_state: 'advisory_installed',
					gate_mode: 'gate'
				}
			]
		];

		const workspace = await loadOrCreateWorkspaceState(db as unknown as D1Database, {
			alphaFreeUnlock: false,
			ownerLabel: "Olen's workspace",
			ownerUserId: 'user_123'
		});

		expect(workspace.metrics.gatesEnabled).toBe(0);
	});
});
