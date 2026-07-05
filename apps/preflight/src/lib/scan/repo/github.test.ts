import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RepoScanError, githubFetchers } from './github';
import type { RepoRef } from './parse';

const fetchMock = vi.fn<typeof fetch>();
const repo: RepoRef = { owner: 'deploylint', repo: 'app' };

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('githubFetchers', () => {
	it('maps repository metadata from GitHub API responses', async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				default_branch: 'trunk',
				description: 'Launch checker',
				stargazers_count: 42,
				license: { spdx_id: 'MIT' }
			})
		);

		const meta = await githubFetchers('ghp_token').getMeta(repo);

		expect(meta).toEqual({
			branch: 'trunk',
			description: 'Launch checker',
			stars: 42,
			licenseSpdx: 'MIT'
		});
		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.github.com/repos/deploylint/app',
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: 'Bearer ghp_token' })
			})
		);
	});

	it('turns GitHub 404s into typed repo scan errors', async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Not Found' }, 404));

		await expect(githubFetchers().getMeta(repo)).rejects.toMatchObject({
			name: 'RepoScanError',
			status: 404
		} satisfies Partial<RepoScanError>);
	});

	it('normalizes rate limit responses to a retryable repo scan error', async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'rate limited' }, 403));

		await expect(githubFetchers().getTree(repo, 'main')).rejects.toMatchObject({
			message: expect.stringContaining('GitHub API rate limit reached'),
			status: 403
		});
	});

	it('filters recursive tree entries down to blobs and trees with paths', async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				truncated: true,
				tree: [
					{ path: 'package.json', type: 'blob', size: 123 },
					{ path: 'src', type: 'tree' },
					{ path: 'commit', type: 'commit' },
					{ type: 'blob', size: 99 }
				]
			})
		);

		const tree = await githubFetchers().getTree(repo, 'main');

		expect(tree).toEqual({
			truncated: true,
			entries: [
				{ path: 'package.json', type: 'blob', size: 123 },
				{ path: 'src', type: 'tree', size: undefined }
			]
		});
	});

	it('returns decoded raw file text within the byte cap', async () => {
		fetchMock.mockResolvedValueOnce(new Response('hello'));

		await expect(githubFetchers().getFile(repo, 'main', 'README.md', 10)).resolves.toBe('hello');
		expect(fetchMock).toHaveBeenCalledWith(
			'https://raw.githubusercontent.com/deploylint/app/main/README.md',
			expect.objectContaining({
				headers: expect.objectContaining({ 'User-Agent': expect.any(String) })
			})
		);
	});

	it('returns null for missing, oversized, or failed raw files', async () => {
		fetchMock
			.mockResolvedValueOnce(new Response('missing', { status: 404 }))
			.mockResolvedValueOnce(new Response('too large'))
			.mockRejectedValueOnce(new Error('network down'));

		await expect(githubFetchers().getFile(repo, 'main', 'missing.txt')).resolves.toBeNull();
		await expect(githubFetchers().getFile(repo, 'main', 'large.txt', 3)).resolves.toBeNull();
		await expect(githubFetchers().getFile(repo, 'main', 'error.txt')).resolves.toBeNull();
	});
});
