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
	const impactMetric = (v: string | undefined) => ({ H: 0.56, L: 0.22, N: 0 })[v ?? ''];
	const c = impactMetric(metrics.C);
	const i = impactMetric(metrics.I);
	const a = impactMetric(metrics.A);
	if ([av, ac, pr, ui, c, i, a].some((v) => v == null)) return null;
	const [avScore, acScore, prScore, uiScore, cScore, iScore, aScore] = [
		av,
		ac,
		pr,
		ui,
		c,
		i,
		a
	] as number[];

	const impact = 1 - (1 - cScore) * (1 - iScore) * (1 - aScore);
	if (impact <= 0) return null;
	const impactScore = scopeChanged
		? 7.52 * (impact - 0.029) - 3.25 * Math.pow(impact - 0.02, 15)
		: 6.42 * impact;
	const exploitability = 8.22 * avScore * acScore * prScore * uiScore;
	const base = scopeChanged
		? Math.min(1.08 * (impactScore + exploitability), 10)
		: Math.min(impactScore + exploitability, 10);
	return severityFromScore(Math.ceil(base * 10) / 10);
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
					severity?: Array<{ type?: string; score?: string }>;
				};
				const severities = [
					normalizeSeverity(body.database_specific?.severity),
					...(body.severity ?? []).map((s) => normalizeSeverity(s.score))
				].filter((s): s is OsvSeverity => Boolean(s));
				for (const severity of severities) {
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
