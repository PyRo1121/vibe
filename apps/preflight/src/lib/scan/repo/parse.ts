export interface RepoRef {
	owner: string;
	repo: string;
}

/** github.com paths that are never owner names. */
const RESERVED = new Set([
	'topics',
	'orgs',
	'collections',
	'sponsors',
	'marketplace',
	'features',
	'about',
	'pricing',
	'settings',
	'notifications',
	'explore',
	'trending',
	'login',
	'signup',
	'search',
	'apps',
	'enterprise',
	'customer-stories',
	'readme',
	'security'
]);

const NAME = /^[A-Za-z0-9][\w.-]*$/;

/**
 * Recognize GitHub repository URLs (with or without protocol, .git suffix,
 * or deep paths like /tree/main). Returns null for anything else so the
 * caller falls through to the normal site scan.
 */
export function parseRepoUrl(input: string): RepoRef | null {
	const trimmed = input.trim();
	const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

	let url: URL;
	try {
		url = new URL(withProtocol);
	} catch {
		return null;
	}

	const host = url.hostname.toLowerCase();
	if (host !== 'github.com' && host !== 'www.github.com') return null;

	const parts = url.pathname.split('/').filter(Boolean);
	if (parts.length < 2) return null;

	const owner = parts[0];
	const repo = parts[1].replace(/\.git$/i, '');
	if (!NAME.test(owner) || !NAME.test(repo)) return null;
	if (RESERVED.has(owner.toLowerCase())) return null;

	return { owner, repo };
}

export function repoHtmlUrl(ref: RepoRef): string {
	return `https://github.com/${ref.owner}/${ref.repo}`;
}
