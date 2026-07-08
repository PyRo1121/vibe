import { normalizeProjectId } from '$lib/product/project-id';
import type { ProjectReportSummary } from '$lib/product/workspace';
import type { ScanReport } from '$lib/scan/types';

export interface ProjectReportContext {
	projectId?: string;
	commitSha?: string;
	branch?: string;
	pullRequest?: string;
}

interface ProjectReportRow {
	id: string;
	score: number;
	verdict: ProjectReportSummary['verdict'];
	scanned_at: string;
	fixed_count: number;
	regressed_count: number;
}

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function newProjectReportId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return `prpt_${[...bytes].map((byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join('')}`;
}

function cleanCiContext(value: string | undefined, maxLength: number): string | null {
	const clean = value?.replace(/\s+/g, ' ').trim().slice(0, maxLength);
	return clean || null;
}

function isProjectReportRow(value: unknown): value is ProjectReportRow {
	return (
		value !== null &&
		typeof value === 'object' &&
		'id' in value &&
		typeof value.id === 'string' &&
		'score' in value &&
		typeof value.score === 'number' &&
		'verdict' in value &&
		(value.verdict === 'go' || value.verdict === 'conditional' || value.verdict === 'no-go') &&
		'scanned_at' in value &&
		typeof value.scanned_at === 'string' &&
		'fixed_count' in value &&
		typeof value.fixed_count === 'number' &&
		'regressed_count' in value &&
		typeof value.regressed_count === 'number'
	);
}

export async function recordProjectReport(
	db: D1Database | undefined,
	context: ProjectReportContext,
	report: ScanReport
): Promise<boolean> {
	const projectId = normalizeProjectId(context.projectId);
	if (!db || !projectId) return false;

	const now = Date.now();
	const fixedCount = report.scanDiff?.fixed.length ?? 0;
	const regressedCount = report.scanDiff?.regressed.length ?? 0;

	try {
		await db
			.prepare(
				`INSERT INTO project_report (
					id,
					project_id,
					report_id,
					score,
					verdict,
					scanned_at,
					fixed_count,
					regressed_count,
					final_url,
					commit_sha,
					branch,
					pull_request,
					created_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				newProjectReportId(),
				projectId,
				report.reportId ?? null,
				report.score,
				report.verdict,
				report.scannedAt,
				fixedCount,
				regressedCount,
				report.finalUrl,
				cleanCiContext(context.commitSha, 80),
				cleanCiContext(context.branch, 120),
				cleanCiContext(context.pullRequest, 40),
				now
			)
			.run();

		await db
			.prepare(
				`UPDATE project
				SET install_state = CASE
						WHEN install_state = 'gate_enabled' THEN install_state
						ELSE 'advisory_installed'
					END,
					updated_at = ?
				WHERE id = ?`
			)
			.bind(now, projectId)
			.run();

		return true;
	} catch {
		return false;
	}
}

export async function loadLatestProjectReport(
	db: D1Database | undefined,
	projectId: string | undefined
): Promise<ProjectReportSummary | null> {
	const normalizedProjectId = normalizeProjectId(projectId);
	if (!db || !normalizedProjectId) return null;

	try {
		const row = await db
			.prepare(
				`SELECT id, score, verdict, scanned_at, fixed_count, regressed_count
				FROM project_report
				WHERE project_id = ?
				ORDER BY scanned_at DESC, created_at DESC
				LIMIT 1`
			)
			.bind(normalizedProjectId)
			.first();

		if (!isProjectReportRow(row)) return null;
		return {
			id: row.id,
			score: row.score,
			verdict: row.verdict,
			scannedAt: row.scanned_at,
			fixedCount: row.fixed_count,
			regressedCount: row.regressed_count
		};
	} catch {
		return null;
	}
}
