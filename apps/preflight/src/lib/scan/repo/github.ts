import { USER_AGENT } from '$lib/scan/constants';
import type { RepoRef } from '$lib/scan/repo/parse';

/** GitHub fetch layer — injectable so tests and future sources need no network. */

export interface RepoMeta {
	branch: string;
	description: string | null;
	stars: number | null;
	/** SPDX id ('MIT', 'NOASSERTION', …) or null when no license file exists. */
	licenseSpdx: string | null;
}

export interface RepoTreeEntry {
	path: string;
	type: 'blob' | 'tree';
	size?: number;
}

export interface RepoTree {
	entries: RepoTreeEntry[];
	truncated: boolean;
}

export interface RepoFetchers {
	getMeta(ref: RepoRef): Promise<RepoMeta>;
	getTree(ref: RepoRef, branch: string): Promise<RepoTree>;
	/** maxBytes overrides the default 300KB cap (lockfiles routinely exceed it). */
	getFile(ref: RepoRef, branch: string, path: string, maxBytes?: number): Promise<string | null>;
}

export class RepoScanError extends Error {
	constructor(
		message: string,
		public readonly status: number | null
	) {
		super(message);
		this.name = 'RepoScanError';
	}
}

const API_TIMEOUT_MS = 10_000;
const MAX_FILE_BYTES = 300 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | null {
	return typeof value === 'string' ? value : null;
}

function numberValue(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readRepoMeta(body: unknown): RepoMeta {
	const data = isRecord(body) ? body : {};
	const license = isRecord(data.license) ? data.license : {};

	return {
		branch: stringValue(data.default_branch) ?? 'main',
		description: stringValue(data.description),
		stars: numberValue(data.stargazers_count),
		licenseSpdx: stringValue(license.spdx_id)
	};
}

function readTreeEntry(value: unknown): RepoTreeEntry | null {
	if (!isRecord(value)) return null;

	const path = stringValue(value.path);
	const type = value.type;
	if (!path || (type !== 'blob' && type !== 'tree')) return null;

	const size = numberValue(value.size) ?? undefined;
	return { path, type, size };
}

function readRepoTree(body: unknown): RepoTree {
	const data = isRecord(body) ? body : {};
	const tree = Array.isArray(data.tree) ? data.tree : [];

	return {
		entries: tree.map(readTreeEntry).filter((entry): entry is RepoTreeEntry => entry !== null),
		truncated: data.truncated === true
	};
}

function apiHeaders(token?: string): Record<string, string> {
	return {
		Accept: 'application/vnd.github+json',
		'User-Agent': USER_AGENT,
		...(token ? { Authorization: `Bearer ${token}` } : {})
	};
}

async function apiGet(url: string, token?: string): Promise<Response> {
	return fetch(url, {
		headers: apiHeaders(token),
		signal: AbortSignal.timeout(API_TIMEOUT_MS)
	});
}

function throwForStatus(res: Response, ref: RepoRef): never {
	if (res.status === 404) {
		throw new RepoScanError(
			`Repository ${ref.owner}/${ref.repo} not found — check the URL, or the repo is private. Deploylint scans public repos only.`,
			404
		);
	}
	if (res.status === 403 || res.status === 429) {
		throw new RepoScanError(
			'GitHub API rate limit reached — try again in a few minutes.',
			res.status
		);
	}
	throw new RepoScanError(`GitHub API error (HTTP ${res.status})`, res.status);
}

export function githubFetchers(token?: string): RepoFetchers {
	return {
		async getMeta(ref) {
			const res = await apiGet(`https://api.github.com/repos/${ref.owner}/${ref.repo}`, token);
			if (!res.ok) throwForStatus(res, ref);
			return readRepoMeta(await res.json());
		},

		async getTree(ref, branch) {
			const res = await apiGet(
				`https://api.github.com/repos/${ref.owner}/${ref.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
				token
			);
			if (!res.ok) throwForStatus(res, ref);
			return readRepoTree(await res.json());
		},

		async getFile(ref, branch, path, maxBytes = MAX_FILE_BYTES) {
			try {
				const res = await fetch(
					`https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${encodeURIComponent(branch)}/${path}`,
					{ headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(API_TIMEOUT_MS) }
				);
				if (!res.ok) return null;
				const buf = await res.arrayBuffer();
				if (buf.byteLength > maxBytes) return null;
				return new TextDecoder('utf-8').decode(buf);
			} catch {
				return null;
			}
		}
	};
}
