import type { ScanReport } from '$lib/scan/types';
import { stableStorageKey } from '$lib/server/storage-key';

/**
 * Durable report storage for shareable permalinks. Reports are stored in
 * their free (prompt-stripped) form — a public link must never leak paid
 * fix prompts — and expire after 90 days.
 */

const TTL_SECONDS = 60 * 60 * 24 * 90;
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const ID_PATTERN = /^[a-z0-9]{8,20}$/;

export function newReportId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(12));
	return [...bytes].map((b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
}

/** Returns the permalink id, or null when storage fails — scans never break on KV errors. */
export async function saveReport(kv: KVNamespace, report: ScanReport): Promise<string | null> {
	try {
		const id = newReportId();
		await kv.put(`report:${id}`, JSON.stringify(report), { expirationTtl: TTL_SECONDS });
		return id;
	} catch {
		return null;
	}
}

export async function loadReport(kv: KVNamespace, id: string): Promise<ScanReport | null> {
	if (!ID_PATTERN.test(id)) return null;
	try {
		return await kv.get<ScanReport>(`report:${id}`, 'json');
	} catch {
		return null;
	}
}

export interface HistoryEntry {
	/** Permalink report id. */
	id: string;
	score: number;
	verdict: string;
	at: string;
	/** Non-passing check ids → status at scan time. Absent id = passing. */
	issues?: Record<string, 'fail' | 'warn'>;
}

const MAX_HISTORY = 20;
const HISTORY_TTL_SECONDS = 60 * 60 * 24 * 180;

export function historyKey(finalUrl: string): string | null {
	try {
		const u = new URL(finalUrl);
		if (u.pathname !== '/') u.pathname = u.pathname.replace(/\/$/, '');
		return stableStorageKey('history', u.href);
	} catch {
		return null;
	}
}

/**
 * Records this scan and returns the *prior* entries (oldest first) so the
 * report can show a trend. Failures return [] — history is never worth
 * breaking a scan over.
 */
export async function appendHistory(
	kv: KVNamespace,
	finalUrl: string,
	entry: HistoryEntry
): Promise<HistoryEntry[]> {
	const key = historyKey(finalUrl);
	if (!key) return [];
	try {
		const previous = (await kv.get<HistoryEntry[]>(key, 'json')) ?? [];
		const next = [...previous, entry].slice(-MAX_HISTORY);
		await kv.put(key, JSON.stringify(next), { expirationTtl: HISTORY_TTL_SECONDS });
		return previous;
	} catch {
		return [];
	}
}

/** Compact map of non-passing check ids for history storage. */
export function issueMap(
	checks: Array<{ id: string; status: string }>
): Record<string, 'fail' | 'warn'> {
	const map: Record<string, 'fail' | 'warn'> = {};
	for (const check of checks) {
		if (check.status === 'fail' || check.status === 'warn') map[check.id] = check.status;
	}
	return map;
}

/**
 * Check-level delta vs the previous scan of the same URL. `fixed` are checks
 * that were failing/warning last time and pass now; `regressed` are checks
 * that pass→non-pass since last time (includes newly added checks — we can't
 * tell those apart, and both deserve attention).
 */
export function computeScanDiff(
	previousIssues: Record<string, 'fail' | 'warn'>,
	checks: Array<{ id: string; status: string; title: string }>
): { fixed: string[]; regressed: string[] } | null {
	const fixed: string[] = [];
	const regressed: string[] = [];
	for (const check of checks) {
		const wasIssue = check.id in previousIssues;
		const isIssue = check.status === 'fail' || check.status === 'warn';
		if (wasIssue && !isIssue) fixed.push(check.title);
		if (!wasIssue && isIssue) regressed.push(check.title);
	}
	if (fixed.length === 0 && regressed.length === 0) return null;
	return { fixed, regressed };
}
