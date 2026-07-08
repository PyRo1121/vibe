import { DEFAULT_DEPLOYLINT_API } from '@vibe/deploylint-shared';

import type { ScanOptions, ScanReport } from './types.js';

export function apiBase(): string {
	return (
		process.env.DEPLOYLINT_API ??
		process.env.PREFLIGHT_API ??
		DEFAULT_DEPLOYLINT_API
	).replace(/\/+$/, '');
}

export function reportUrl(report: ScanReport): string | null {
	if (!report.reportId) return null;
	return `${apiBase()}/r/${report.reportId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function hasSummary(value: unknown): value is ScanReport['summary'] {
	return (
		isRecord(value) &&
		typeof value.pass === 'number' &&
		typeof value.warn === 'number' &&
		typeof value.fail === 'number'
	);
}

function isScanReport(value: unknown): value is ScanReport {
	return (
		isRecord(value) &&
		typeof value.url === 'string' &&
		typeof value.finalUrl === 'string' &&
		typeof value.score === 'number' &&
		typeof value.verdict === 'string' &&
		typeof value.verdictMessage === 'string' &&
		hasSummary(value.summary) &&
		Array.isArray(value.checks)
	);
}

function errorMessage(value: unknown): string | null {
	if (!isRecord(value) || typeof value.message !== 'string') return null;
	const message = value.message.trim();
	return message.length > 0 ? message : null;
}

export async function fetchScan(opts: ScanOptions): Promise<ScanReport> {
	const body: Record<string, unknown> = { url: opts.url.trim() };
	if (opts.unlockSessionId) body.unlockSessionId = opts.unlockSessionId;
	if (opts.previousScore != null) body.previousScore = opts.previousScore;

	const res = await fetch(`${apiBase()}/api/scan`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});

	const json: unknown = await res.json().catch(() => null);
	if (!res.ok) {
		throw new Error(errorMessage(json) ?? `HTTP ${res.status}`);
	}

	if (!isScanReport(json)) {
		throw new Error('Invalid Deploylint scan response');
	}

	return json;
}
