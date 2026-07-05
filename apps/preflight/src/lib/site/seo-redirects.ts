export const SEO_LEGACY_REDIRECTS = {
	'launch-readiness-checker': '/guides/website-launch-checklist',
	'ai-app-launch-checker': '/guides/ai-app-launch-checker',
	'vibe-code-launch-checklist': '/guides/website-launch-checklist'
} as const;

export function getSeoLegacyRedirect(slug: string): string | null {
	return SEO_LEGACY_REDIRECTS[slug as keyof typeof SEO_LEGACY_REDIRECTS] ?? null;
}
