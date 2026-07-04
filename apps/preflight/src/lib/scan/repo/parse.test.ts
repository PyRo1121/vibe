import { describe, expect, it } from 'vitest';
import { parseRepoUrl } from '$lib/scan/repo/parse';

describe('parseRepoUrl', () => {
	it('parses a plain repo URL', () => {
		expect(parseRepoUrl('https://github.com/sveltejs/svelte')).toEqual({
			owner: 'sveltejs',
			repo: 'svelte'
		});
	});

	it('accepts protocol-less input and www', () => {
		expect(parseRepoUrl('github.com/foo/bar')).toEqual({ owner: 'foo', repo: 'bar' });
		expect(parseRepoUrl('www.github.com/foo/bar')).toEqual({ owner: 'foo', repo: 'bar' });
	});

	it('strips .git and deep paths', () => {
		expect(parseRepoUrl('https://github.com/foo/bar.git')).toEqual({ owner: 'foo', repo: 'bar' });
		expect(parseRepoUrl('https://github.com/foo/bar/tree/main/src')).toEqual({
			owner: 'foo',
			repo: 'bar'
		});
	});

	it('rejects non-GitHub hosts and non-repo paths', () => {
		expect(parseRepoUrl('https://gitlab.com/foo/bar')).toBeNull();
		expect(parseRepoUrl('https://github.com/foo')).toBeNull();
		expect(parseRepoUrl('https://github.com/topics/javascript')).toBeNull();
		expect(parseRepoUrl('https://example.com')).toBeNull();
		expect(parseRepoUrl('my-app.com')).toBeNull();
	});
});
