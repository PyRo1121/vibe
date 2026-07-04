import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ platform }) => ({
	siteName: platform?.env?.PUBLIC_SITE_NAME ?? 'TCG Vault',
	siteUrl: platform?.env?.PUBLIC_SITE_URL ?? 'https://vault.latham.cloud'
});
