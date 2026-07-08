import {
	isDeploylintPlanId,
	resolveDeploylintPlan,
	type DeploylintPlanId
} from '$lib/product/plans';
import { normalizeProjectId } from '$lib/product/project-id';
import {
	buildWorkspaceSetupState,
	type DeploylintProject,
	type DeploylintWorkspace,
	type ProjectDraft,
	type ProjectGateMode,
	type ProjectInstallState,
	type WorkspaceBillingState
} from '$lib/product/workspace';
import { loadProjectReportHistory } from '$lib/server/project-reports';

interface WorkspaceRow {
	id: string;
	name: string;
}

interface ProjectRow {
	id: string;
	name: string;
	deploy_url: string;
	repo_label: string;
	workflow_path: string;
	install_state: string;
	gate_mode: string;
	min_score: number;
}

interface SubscriptionRow {
	plan: string;
	status: string;
}

interface CountRow {
	count: number;
}

export interface WorkspaceStoreOptions {
	alphaFreeUnlock: boolean;
	ownerLabel: string;
	ownerUserId: string;
	projectDraft?: ProjectDraft;
}

export type PromoteProjectToGateResult =
	| { ok: true }
	| {
			ok: false;
			reason: 'invalid-project' | 'missing-db' | 'not-found' | 'not-ready' | 'storage-error';
	  };

export interface WorkspaceSubscriptionCheckout {
	customerId: string | null;
	plan: unknown;
	projectId: unknown;
	stripeSubscriptionId: string | null;
	workspaceId: unknown;
}

export type WorkspaceSubscriptionStatus = 'active' | 'canceled' | 'past_due';

export interface WorkspaceBillingCustomer {
	customerId: string;
	workspaceId: string;
}

const PLAN_LIMITS: Record<DeploylintPlanId, number> = {
	solo: 1,
	builder: 5,
	agency: 25
};

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function newId(prefix: 'proj' | 'wks'): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return `${prefix}_${[...bytes].map((byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join('')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWorkspaceRow(value: unknown): value is WorkspaceRow {
	return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string';
}

function isProjectRow(value: unknown): value is ProjectRow {
	return (
		isRecord(value) &&
		typeof value.id === 'string' &&
		typeof value.name === 'string' &&
		typeof value.deploy_url === 'string' &&
		typeof value.repo_label === 'string' &&
		typeof value.workflow_path === 'string' &&
		typeof value.install_state === 'string' &&
		typeof value.gate_mode === 'string' &&
		typeof value.min_score === 'number'
	);
}

function isSubscriptionRow(value: unknown): value is SubscriptionRow {
	return isRecord(value) && typeof value.plan === 'string' && typeof value.status === 'string';
}

function isCountRow(value: unknown): value is CountRow {
	return isRecord(value) && typeof value.count === 'number';
}

function installState(value: string): ProjectInstallState {
	if (value === 'advisory_installed' || value === 'gate_enabled') return value;
	return 'not_installed';
}

function gateMode(value: string): ProjectGateMode {
	return value === 'gate' ? 'gate' : 'advisory';
}

function monthStartMs(now = new Date()): number {
	return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
}

function fallbackWorkspace(opts: WorkspaceStoreOptions): DeploylintWorkspace {
	return buildWorkspaceSetupState({
		appUrl: 'https://deploylint.com',
		alphaFreeUnlock: opts.alphaFreeUnlock,
		ownerLabel: opts.ownerLabel,
		projectDraft: opts.projectDraft
	});
}

function defaultProjectDraft(opts: WorkspaceStoreOptions): DeploylintProject {
	const workspace = fallbackWorkspace(opts);
	return workspace.projects[0];
}

async function loadWorkspaceRow(db: D1Database, ownerUserId: string): Promise<WorkspaceRow | null> {
	const row = await db
		.prepare(
			`SELECT id, name
			FROM workspace
			WHERE owner_user_id = ?
			ORDER BY created_at ASC
			LIMIT 1`
		)
		.bind(ownerUserId)
		.first();
	return isWorkspaceRow(row) ? row : null;
}

async function createWorkspaceRow(
	db: D1Database,
	opts: WorkspaceStoreOptions
): Promise<WorkspaceRow> {
	const now = Date.now();
	const row = {
		id: newId('wks'),
		name: opts.ownerLabel
	};
	await db
		.prepare(
			`INSERT INTO workspace (id, owner_user_id, name, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?)`
		)
		.bind(row.id, opts.ownerUserId, row.name, now, now)
		.run();
	return row;
}

async function loadProjectRows(db: D1Database, workspaceId: string): Promise<ProjectRow[]> {
	const { results } = await db
		.prepare(
			`SELECT id, name, deploy_url, repo_label, workflow_path, install_state, gate_mode, min_score
			FROM project
			WHERE workspace_id = ?
			ORDER BY created_at ASC`
		)
		.bind(workspaceId)
		.all();
	return (results as unknown[]).filter(isProjectRow);
}

async function loadOwnedProjectRow(
	db: D1Database,
	ownerUserId: string,
	projectId: string
): Promise<ProjectRow | null> {
	const row = await db
		.prepare(
			`SELECT project.id, project.name, project.deploy_url, project.repo_label, project.workflow_path,
				project.install_state, project.gate_mode, project.min_score
			FROM project
			INNER JOIN workspace ON workspace.id = project.workspace_id
			WHERE workspace.owner_user_id = ?
				AND project.id = ?
			LIMIT 1`
		)
		.bind(ownerUserId, projectId)
		.first();
	return isProjectRow(row) ? row : null;
}

async function createProjectRow(
	db: D1Database,
	workspaceId: string,
	opts: WorkspaceStoreOptions
): Promise<ProjectRow> {
	const now = Date.now();
	const project = defaultProjectDraft(opts);
	const row = {
		id: newId('proj'),
		name: project.name,
		deploy_url: project.deployUrl,
		repo_label: project.repoLabel,
		workflow_path: project.workflowPath,
		install_state: project.installState,
		gate_mode: project.gateMode,
		min_score: project.minScore
	};
	await db
		.prepare(
			`INSERT INTO project (
				id,
				workspace_id,
				name,
				deploy_url,
				repo_label,
				workflow_path,
				install_state,
				gate_mode,
				min_score,
				created_at,
				updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			row.id,
			workspaceId,
			row.name,
			row.deploy_url,
			row.repo_label,
			row.workflow_path,
			row.install_state,
			row.gate_mode,
			row.min_score,
			now,
			now
		)
		.run();
	return row;
}

async function loadSubscriptionRow(
	db: D1Database,
	workspaceId: string
): Promise<SubscriptionRow | null> {
	const row = await db
		.prepare(
			`SELECT plan, status
			FROM subscription
			WHERE workspace_id = ?
			ORDER BY updated_at DESC
			LIMIT 1`
		)
		.bind(workspaceId)
		.first();
	return isSubscriptionRow(row) ? row : null;
}

async function countReportsThisMonth(db: D1Database, workspaceId: string): Promise<number> {
	const row = await db
		.prepare(
			`SELECT COUNT(*) AS count
			FROM project_report
			INNER JOIN project ON project.id = project_report.project_id
			WHERE project.workspace_id = ?
				AND project_report.created_at >= ?`
		)
		.bind(workspaceId, monthStartMs())
		.first();
	return isCountRow(row) ? row.count : 0;
}

function billingState(
	alphaFreeUnlock: boolean,
	subscription: SubscriptionRow | null
): WorkspaceBillingState {
	if (alphaFreeUnlock) {
		return {
			mode: 'alpha',
			planLabel: 'Early access',
			projectLimit: 1
		};
	}

	const plan = resolveDeploylintPlan(subscription?.plan);
	const paid = subscription?.status === 'active' || subscription?.status === 'trialing';
	return {
		mode: paid ? 'paid' : 'setup',
		planLabel: plan.name,
		projectLimit: PLAN_LIMITS[plan.id]
	};
}

async function projectFromRow(db: D1Database, row: ProjectRow): Promise<DeploylintProject> {
	const reportHistory = await loadProjectReportHistory(db, row.id, 10);
	const latestHistoryReport = reportHistory[0];
	return {
		id: row.id,
		name: row.name,
		deployUrl: row.deploy_url,
		repoLabel: row.repo_label,
		workflowPath: row.workflow_path,
		installState: installState(row.install_state),
		gateMode: gateMode(row.gate_mode),
		minScore: row.min_score,
		latestReport: latestHistoryReport
			? {
					id: latestHistoryReport.id,
					score: latestHistoryReport.score,
					verdict: latestHistoryReport.verdict,
					scannedAt: latestHistoryReport.scannedAt,
					fixedCount: latestHistoryReport.fixedCount,
					regressedCount: latestHistoryReport.regressedCount
				}
			: null,
		reportHistory
	};
}

export async function loadOrCreateWorkspaceState(
	db: D1Database | undefined,
	opts: WorkspaceStoreOptions
): Promise<DeploylintWorkspace> {
	if (!db) return fallbackWorkspace(opts);

	try {
		const workspace =
			(await loadWorkspaceRow(db, opts.ownerUserId)) ?? (await createWorkspaceRow(db, opts));
		const loadedProjects = await loadProjectRows(db, workspace.id);
		const projectRows =
			loadedProjects.length > 0 ? loadedProjects : [await createProjectRow(db, workspace.id, opts)];
		const projects = await Promise.all(projectRows.map((row) => projectFromRow(db, row)));
		const subscription = await loadSubscriptionRow(db, workspace.id);
		const reportsThisMonth = await countReportsThisMonth(db, workspace.id);

		return {
			id: workspace.id,
			ownerLabel: workspace.name,
			billing: billingState(opts.alphaFreeUnlock, subscription),
			projects,
			metrics: {
				activeProjects: projects.length,
				gatesEnabled: projects.filter(
					(project) => project.installState === 'gate_enabled' && project.gateMode === 'gate'
				).length,
				reportsThisMonth
			}
		};
	} catch {
		return fallbackWorkspace(opts);
	}
}

export async function promoteProjectToGate(
	db: D1Database | undefined,
	ownerUserId: string,
	projectIdValue: unknown
): Promise<PromoteProjectToGateResult> {
	if (!db) return { ok: false, reason: 'missing-db' };

	const projectId = normalizeProjectId(projectIdValue);
	if (!projectId) return { ok: false, reason: 'invalid-project' };

	try {
		const project = await loadOwnedProjectRow(db, ownerUserId, projectId);
		if (!project) return { ok: false, reason: 'not-found' };

		const [latestReport] = await loadProjectReportHistory(db, project.id, 1);
		const ready = latestReport?.verdict === 'go' && latestReport.score >= project.min_score;
		if (!ready) return { ok: false, reason: 'not-ready' };

		await db
			.prepare(
				`UPDATE project
				SET install_state = 'gate_enabled',
					gate_mode = 'gate',
					updated_at = ?
				WHERE id = ?`
			)
			.bind(Date.now(), project.id)
			.run();

		return { ok: true };
	} catch {
		return { ok: false, reason: 'storage-error' };
	}
}

export async function upsertWorkspaceSubscription(
	db: D1Database | undefined,
	checkout: WorkspaceSubscriptionCheckout
): Promise<boolean> {
	if (!db) return false;

	const workspaceId = normalizeProjectId(checkout.workspaceId);
	const projectId = normalizeProjectId(checkout.projectId);
	const plan = isDeploylintPlanId(checkout.plan) ? checkout.plan : null;
	const customerId = checkout.customerId?.trim();
	const stripeSubscriptionId = checkout.stripeSubscriptionId?.trim();
	if (!workspaceId || !projectId || !plan || !customerId || !stripeSubscriptionId) return false;

	const now = Date.now();
	await db
		.prepare(
			`INSERT INTO subscription (
				id,
				workspace_id,
				stripe_customer_id,
				stripe_subscription_id,
				plan,
				status,
				created_at,
				updated_at
			) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				stripe_customer_id = excluded.stripe_customer_id,
				stripe_subscription_id = excluded.stripe_subscription_id,
				plan = excluded.plan,
				status = 'active',
				updated_at = excluded.updated_at`
		)
		.bind(`sub_${workspaceId}`, workspaceId, customerId, stripeSubscriptionId, plan, now, now)
		.run();

	return true;
}

export async function loadWorkspaceBillingCustomer(
	db: D1Database | undefined,
	ownerUserId: string
): Promise<WorkspaceBillingCustomer | null> {
	if (!db) return null;

	const row = await db
		.prepare(
			`SELECT subscription.stripe_customer_id, workspace.id AS workspace_id
			FROM subscription
			INNER JOIN workspace ON workspace.id = subscription.workspace_id
			WHERE workspace.owner_user_id = ?
				AND subscription.status IN ('active', 'past_due')
				AND subscription.stripe_customer_id IS NOT NULL
			ORDER BY subscription.updated_at DESC
			LIMIT 1`
		)
		.bind(ownerUserId)
		.first<{ stripe_customer_id?: unknown; workspace_id?: unknown }>();
	const customerId =
		typeof row?.stripe_customer_id === 'string' ? row.stripe_customer_id.trim() : '';
	const workspaceId = typeof row?.workspace_id === 'string' ? row.workspace_id.trim() : '';

	return customerId && workspaceId ? { customerId, workspaceId } : null;
}

export async function updateWorkspaceSubscriptionStatus(
	db: D1Database | undefined,
	stripeSubscriptionId: string | null,
	status: WorkspaceSubscriptionStatus
): Promise<boolean> {
	const subscriptionId = stripeSubscriptionId?.trim();
	if (!db || !subscriptionId) return false;

	await db
		.prepare(
			`UPDATE subscription
			SET status = ?,
				updated_at = ?
			WHERE stripe_subscription_id = ?`
		)
		.bind(status, Date.now(), subscriptionId)
		.run();

	return true;
}
