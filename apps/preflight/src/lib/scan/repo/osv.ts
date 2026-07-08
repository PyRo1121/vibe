import type { LockPackage } from '$lib/scan/repo/lockfile';

/**
 * Known-vulnerability audit via OSV.dev (Google's open vulnerability
 * database). One batch POST covers the whole lockfile; a handful of detail
 * lookups establish worst severity. Free API, no key.
 */

export type OsvSeverity = 'critical' | 'high' | 'moderate' | 'low';

export interface OsvFinding {
	package: string;
	version: string;
	vulnIds: string[];
}

export interface OsvAudit {
	checked: number;
	findings: OsvFinding[];
	/** Worst severity among sampled vulns — null when OSV had no severity data. */
	worstSeverity: OsvSeverity | null;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const OSV_BATCH_URL = 'https://api.osv.dev/v1/querybatch';
const OSV_VULN_URL = 'https://api.osv.dev/v1/vulns/';
const TIMEOUT_MS = 10_000;
/** Subrequest budget: severity details for the first few vulns only. */
const MAX_DETAIL_LOOKUPS = 3;

interface BatchResponse {
	results?: Array<{ vulns?: Array<{ id?: string }> } | null>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBatchResults(body: unknown): NonNullable<BatchResponse['results']> {
	if (!isRecord(body)) return [];
	const results = body.results;
	if (!Array.isArray(results)) return [];
	return results.map((result) => {
		if (!isRecord(result)) return null;
		const vulns = result.vulns;
		if (!Array.isArray(vulns)) return {};
		return {
			vulns: vulns
				.filter(isRecord)
				.map((vuln) => ({ id: typeof vuln.id === 'string' ? vuln.id : undefined }))
		};
	});
}

export function parseBatchResults(packages: LockPackage[], body: unknown): OsvFinding[] {
	const findings: OsvFinding[] = [];
	readBatchResults(body).forEach((result, i) => {
		const pkg = packages[i];
		const ids = (result?.vulns ?? []).map((v) => v.id).filter((id): id is string => !!id);
		if (pkg && ids.length > 0) {
			findings.push({ package: pkg.name, version: pkg.version, vulnIds: ids });
		}
	});
	return findings;
}

const SEVERITY_RANK: Record<OsvSeverity, number> = { low: 0, moderate: 1, high: 2, critical: 3 };
const CVSS_IMPACT_METRICS: Record<string, number> = { H: 0.56, L: 0.22, N: 0 };

export function normalizeSeverity(raw?: string): OsvSeverity | null {
	const value = raw?.toLowerCase();
	if (value === 'critical' || value === 'high' || value === 'moderate' || value === 'low') {
		return value;
	}
	if (raw?.startsWith('CVSS:3.')) {
		return severityFromCvss3(raw);
	}
	return null;
}

function severityFromScore(score: number): OsvSeverity | null {
	if (score >= 9) return 'critical';
	if (score >= 7) return 'high';
	if (score >= 4) return 'moderate';
	if (score > 0) return 'low';
	return null;
}

function cvssImpactMetric(value: string | undefined): number | undefined {
	return CVSS_IMPACT_METRICS[value ?? ''];
}

function severityFromCvss3(vector: string): OsvSeverity | null {
	const metrics = Object.fromEntries(
		vector
			.split('/')
			.slice(1)
			.map((part) => part.split(':'))
			.filter((part): part is [string, string] => part.length === 2)
	);
	const scopeChanged = metrics.S === 'C';
	const av = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 }[metrics.AV ?? ''];
	const ac = { L: 0.77, H: 0.44 }[metrics.AC ?? ''];
	const pr = scopeChanged
		? { N: 0.85, L: 0.68, H: 0.5 }[metrics.PR ?? '']
		: { N: 0.85, L: 0.62, H: 0.27 }[metrics.PR ?? ''];
	const ui = { N: 0.85, R: 0.62 }[metrics.UI ?? ''];
	const c = cvssImpactMetric(metrics.C);
	const i = cvssImpactMetric(metrics.I);
	const a = cvssImpactMetric(metrics.A);
	if (
		av === undefined ||
		ac === undefined ||
		pr === undefined ||
		ui === undefined ||
		c === undefined ||
		i === undefined ||
		a === undefined
	) {
		return null;
	}

	const impact = 1 - (1 - c) * (1 - i) * (1 - a);
	if (impact <= 0) return null;
	const impactScore = scopeChanged
		? 7.52 * (impact - 0.029) - 3.25 * Math.pow(impact - 0.02, 15)
		: 6.42 * impact;
	const exploitability = 8.22 * av * ac * pr * ui;
	const base = scopeChanged
		? Math.min(1.08 * (impactScore + exploitability), 10)
		: Math.min(impactScore + exploitability, 10);
	return severityFromScore(Math.ceil(base * 10) / 10);
}

function readDetailSeverities(body: unknown): OsvSeverity[] {
	if (!isRecord(body)) return [];
	const databaseSpecific = isRecord(body.database_specific) ? body.database_specific : null;
	const osvSeverities = Array.isArray(body.severity) ? body.severity.filter(isRecord) : [];

	return [
		normalizeSeverity(
			typeof databaseSpecific?.severity === 'string' ? databaseSpecific.severity : undefined
		),
		...osvSeverities.map((severity) =>
			normalizeSeverity(typeof severity.score === 'string' ? severity.score : undefined)
		)
	].filter((severity): severity is OsvSeverity => Boolean(severity));
}

/** Returns null when OSV is unreachable — the check is skipped, never faked. */
export async function auditVulnerabilities(
	packages: LockPackage[],
	fetchImpl: FetchLike = fetch
): Promise<OsvAudit | null> {
	if (packages.length === 0) return { checked: 0, findings: [], worstSeverity: null };
	try {
		const res = await fetchImpl(OSV_BATCH_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				queries: packages.map((p) => ({
					package: { name: p.name, ecosystem: 'npm' },
					version: p.version
				}))
			}),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		if (!res.ok) return null;
		const findings = parseBatchResults(packages, await res.json());

		let worst: OsvSeverity | null = null;
		const detailIds = [...new Set(findings.flatMap((f) => f.vulnIds))].slice(0, MAX_DETAIL_LOOKUPS);
		for (const id of detailIds) {
			try {
				const detail = await fetchImpl(`${OSV_VULN_URL}${encodeURIComponent(id)}`, {
					signal: AbortSignal.timeout(TIMEOUT_MS)
				});
				if (!detail.ok) continue;
				for (const severity of readDetailSeverities(await detail.json())) {
					if (!worst || SEVERITY_RANK[severity] > SEVERITY_RANK[worst]) {
						worst = severity;
					}
				}
			} catch {
				// Severity detail is best-effort — the finding itself still stands.
			}
		}

		return { checked: packages.length, findings, worstSeverity: worst };
	} catch {
		return null;
	}
}
