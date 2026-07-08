export const SEO_LEGACY_REDIRECTS = {
	'launch-readiness-checker': '/guides/website-launch-checklist',
	'ai-app-launch-checker': '/guides/ai-app-launch-checker',
	'vibe-code-launch-checklist': '/guides/website-launch-checklist'
} as const;

export function getSeoLegacyRedirect(slug: string): string | null {
	switch (slug) {
		case 'launch-readiness-checker':
		case 'ai-app-launch-checker':
		case 'vibe-code-launch-checklist':
			return SEO_LEGACY_REDIRECTS[slug];
		default:
			return null;
	}
}
