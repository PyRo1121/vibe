import changelog from '../../../CHANGELOG.md?raw';
import { renderChangelogHtml } from '$lib/changelog';
import type { PageLoad } from './$types';

export const csr = false;

export const load: PageLoad = () => ({
	html: renderChangelogHtml(changelog)
});
