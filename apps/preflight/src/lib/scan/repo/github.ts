import type { RepoRef } from '$lib/scan/repo/parse';
import { USER_AGENT } from '$lib/scan/constants';

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
			`Repository ${ref.owner}/${ref.repo} not found — check the URL, or the repo is private. Preflight scans public repos only.`,
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
			const body = (await res.json()) as {
				default_branch?: string;
				description?: string | null;
				stargazers_count?: number;
				license?: { spdx_id?: string | null } | null;
			};
			return {
				branch: body.default_branch ?? 'main',
				description: body.description ?? null,
				stars: body.stargazers_count ?? null,
				licenseSpdx: body.license?.spdx_id ?? null
			};
		},

		async getTree(ref, branch) {
			const res = await apiGet(
				`https://api.github.com/repos/${ref.owner}/${ref.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
				token
			);
			if (!res.ok) throwForStatus(res, ref);
			const body = (await res.json()) as {
				tree?: Array<{ path?: string; type?: string; size?: number }>;
				truncated?: boolean;
			};
			return {
				entries: (body.tree ?? [])
					.filter((e) => e.path && (e.type === 'blob' || e.type === 'tree'))
					.map((e) => ({ path: e.path as string, type: e.type as 'blob' | 'tree', size: e.size })),
				truncated: body.truncated ?? false
			};
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
