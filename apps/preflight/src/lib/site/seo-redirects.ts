export const SEO_LEGACY_REDIRECTS = {
	'launch-readiness-checker': '/',
	'ai-app-launch-checker': '/',
	'vibe-code-launch-checklist': '/checks'
} as const;

export function getSeoLegacyRedirect(slug: string): string | null {
	return SEO_LEGACY_REDIRECTS[slug as keyof typeof SEO_LEGACY_REDIRECTS] ?? null;
}
