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

export function parseBatchResults(packages: LockPackage[], body: BatchResponse): OsvFinding[] {
	const findings: OsvFinding[] = [];
	(body.results ?? []).forEach((result, i) => {
		const pkg = packages[i];
		const ids = (result?.vulns ?? []).map((v) => v.id).filter((id): id is string => !!id);
		if (pkg && ids.length > 0) {
			findings.push({ package: pkg.name, version: pkg.version, vulnIds: ids });
		}
	});
	return findings;
}

const SEVERITY_RANK: Record<OsvSeverity, number> = { low: 0, moderate: 1, high: 2, critical: 3 };

export function normalizeSeverity(raw: string | undefined): OsvSeverity | null {
	const value = raw?.toLowerCase();
	if (value === 'critical' || value === 'high' || value === 'moderate' || value === 'low') {
		return value;
	}
	return null;
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
		const findings = parseBatchResults(packages, (await res.json()) as BatchResponse);

		let worst: OsvSeverity | null = null;
		const detailIds = [...new Set(findings.flatMap((f) => f.vulnIds))].slice(0, MAX_DETAIL_LOOKUPS);
		for (const id of detailIds) {
			try {
				const detail = await fetchImpl(`${OSV_VULN_URL}${encodeURIComponent(id)}`, {
					signal: AbortSignal.timeout(TIMEOUT_MS)
				});
				if (!detail.ok) continue;
				const body = (await detail.json()) as {
					database_specific?: { severity?: string };
				};
				const severity = normalizeSeverity(body.database_specific?.severity);
				if (severity && (!worst || SEVERITY_RANK[severity] > SEVERITY_RANK[worst])) {
					worst = severity;
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
