import type { ScanReport } from '$lib/scan/types';
import { describe, expect, it } from 'vitest';

import { loadLatestProjectReport, recordProjectReport } from './project-reports';

interface D1Call {
	sql: string;
	values: unknown[];
	method: 'first' | 'run';
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

	async run(): Promise<unknown> {
		this.db.calls.push({ sql: this.sql, values: this.values, method: 'run' });
		if (this.db.failWrites) throw new Error('D1 write failed');
		return { success: true };
	}

	async first(): Promise<unknown> {
		this.db.calls.push({ sql: this.sql, values: this.values, method: 'first' });
		if (this.db.failReads) throw new Error('D1 read failed');
		return this.db.latestRow;
	}
}

class FakeD1 {
	calls: D1Call[] = [];
	failReads = false;
	failWrites = false;
	latestRow: unknown = null;

	prepare(sql: string): FakeStatement {
		return new FakeStatement(this, sql);
	}
}

const report = {
	url: 'https://app.test',
	finalUrl: 'https://app.test/',
	reportId: 'abc123def456',
	scannedAt: '2026-07-08T12:00:00.000Z',
	score: 74,
	verdict: 'conditional',
	verdictMessage: 'Fix important issues before gate mode.',
	checks: [],
	summary: { pass: 8, warn: 2, fail: 1 },
	scanDiff: {
		fixed: ['Security headers'],
		regressed: ['Payment webhooks', 'Robots policy']
	}
} satisfies ScanReport;

describe('project report storage', () => {
	it('records a project report summary and marks the project advisory-installed', async () => {
		const db = new FakeD1();

		await expect(
			recordProjectReport(
				db as unknown as D1Database,
				{
					projectId: 'proj_live-123',
					commitSha: 'abc1234',
					branch: 'main',
					pullRequest: '42'
				},
				report
			)
		).resolves.toBe(true);

		expect(db.calls).toHaveLength(2);
		expect(db.calls[0].sql).toContain('INSERT INTO project_report');
		expect(db.calls[0].values).toEqual([
			expect.stringMatching(/^prpt_[a-z0-9]{16}$/),
			'proj_live-123',
			'abc123def456',
			74,
			'conditional',
			'2026-07-08T12:00:00.000Z',
			1,
			2,
			'https://app.test/',
			'abc1234',
			'main',
			'42',
			expect.any(Number)
		]);
		expect(db.calls[1].sql).toContain('UPDATE project');
		expect(db.calls[1].values).toEqual([expect.any(Number), 'proj_live-123']);
	});

	it('records minimal reports without optional diff, report id, or CI context', async () => {
		const db = new FakeD1();
		const minimalReport: ScanReport = {
			url: report.url,
			finalUrl: report.finalUrl,
			scannedAt: report.scannedAt,
			score: report.score,
			verdict: report.verdict,
			verdictMessage: report.verdictMessage,
			checks: report.checks,
			summary: report.summary
		};

		await expect(
			recordProjectReport(
				db as unknown as D1Database,
				{
					projectId: 'proj_live-123',
					commitSha: '   ',
					branch: undefined,
					pullRequest: undefined
				},
				minimalReport
			)
		).resolves.toBe(true);

		expect(db.calls[0].values).toEqual([
			expect.stringMatching(/^prpt_[a-z0-9]{16}$/),
			'proj_live-123',
			null,
			74,
			'conditional',
			'2026-07-08T12:00:00.000Z',
			0,
			0,
			'https://app.test/',
			null,
			null,
			null,
			expect.any(Number)
		]);
	});

	it('does not break scans when project report storage fails', async () => {
		const db = new FakeD1();
		db.failWrites = true;

		await expect(
			recordProjectReport(db as unknown as D1Database, { projectId: 'proj_live-123' }, report)
		).resolves.toBe(false);
	});

	it('ignores missing or unsafe project ids', async () => {
		const db = new FakeD1();

		await expect(
			recordProjectReport(db as unknown as D1Database, { projectId: '../bad' }, report)
		).resolves.toBe(false);
		await expect(recordProjectReport(db as unknown as D1Database, {}, report)).resolves.toBe(false);
		expect(db.calls).toEqual([]);
	});

	it('loads the latest report summary for a project', async () => {
		const db = new FakeD1();
		db.latestRow = {
			id: 'prpt_123',
			score: 91,
			verdict: 'go',
			scanned_at: '2026-07-08T12:30:00.000Z',
			fixed_count: 3,
			regressed_count: 0
		};

		await expect(
			loadLatestProjectReport(db as unknown as D1Database, 'proj_live-123')
		).resolves.toEqual({
			id: 'prpt_123',
			score: 91,
			verdict: 'go',
			scannedAt: '2026-07-08T12:30:00.000Z',
			fixedCount: 3,
			regressedCount: 0
		});
		expect(db.calls[0]).toMatchObject({
			method: 'first',
			values: ['proj_live-123']
		});
	});

	it('returns null for missing database, unsafe project ids, malformed rows, and D1 read failures', async () => {
		await expect(loadLatestProjectReport(undefined, 'proj_live-123')).resolves.toBeNull();

		const unsafeDb = new FakeD1();
		await expect(
			loadLatestProjectReport(unsafeDb as unknown as D1Database, '../bad')
		).resolves.toBeNull();
		expect(unsafeDb.calls).toEqual([]);

		const malformedDb = new FakeD1();
		malformedDb.latestRow = {
			id: 'prpt_123',
			score: 91,
			verdict: 'review',
			scanned_at: '2026-07-08T12:30:00.000Z',
			fixed_count: 3,
			regressed_count: 0
		};
		await expect(
			loadLatestProjectReport(malformedDb as unknown as D1Database, 'proj_live-123')
		).resolves.toBeNull();

		const failingDb = new FakeD1();
		failingDb.failReads = true;
		await expect(
			loadLatestProjectReport(failingDb as unknown as D1Database, 'proj_live-123')
		).resolves.toBeNull();
	});
});
