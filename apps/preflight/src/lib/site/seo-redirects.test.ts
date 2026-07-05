import { describe, expect, it } from 'vitest';

import { SEO_LEGACY_REDIRECTS, getSeoLegacyRedirect } from './seo-redirects';

describe('SEO legacy redirects', () => {
	it('keeps keyword-style pages out of the real website while preserving old URLs', () => {
		expect(SEO_LEGACY_REDIRECTS).toEqual({
			'launch-readiness-checker': '/guides/website-launch-checklist',
			'ai-app-launch-checker': '/guides/ai-app-launch-checker',
			'vibe-code-launch-checklist': '/guides/website-launch-checklist'
		});
	});

	it('can look up redirect targets by slug', () => {
		expect(getSeoLegacyRedirect('ai-app-launch-checker')).toBe('/guides/ai-app-launch-checker');
		expect(getSeoLegacyRedirect('missing-page')).toBeNull();
	});
});
