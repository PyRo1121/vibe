import { SEO_LIMITS } from '$lib/scan/constants';
import { parsePageMeta, pickMeta } from '$lib/scan/parse';
import type { SocialPreview } from '$lib/scan/types';

export type { SocialPreview } from '$lib/scan/types';

export function buildSocialPreview(html: string, finalUrl: URL): SocialPreview {
	const meta = parsePageMeta(html, finalUrl);
	const title = meta.resolvedTitle;
	const description = meta.ogDescription ?? meta.description;
	const image = meta.ogImage;
	const twitterCard = pickMeta(html, 'twitter:card');

	let imageUrl: string | null = null;
	if (image) {
		try {
			imageUrl = new URL(image, finalUrl).href;
		} catch {
			imageUrl = null;
		}
	}

	const issues: string[] = [];
	if (!title?.trim()) issues.push('Missing preview title (og:title or <title>)');
	if (!description?.trim()) issues.push('Missing preview description');
	if (!image?.trim()) issues.push('Missing og:image — Slack and X previews will look empty');
	if (image && !imageUrl) issues.push('og:image URL is invalid or relative without a base');
	if (title && title.length > SEO_LIMITS.titlePreview) {
		issues.push('Preview title may truncate on mobile (keep under ~70 chars)');
	}
	if (description && description.length > SEO_LIMITS.descriptionPreview) {
		issues.push('Preview description may truncate (aim for 120–160 chars)');
	}
	if (!twitterCard?.trim() && (title || description)) {
		issues.push('Missing twitter:card — X may show a plain link instead of a card');
	}
	if (twitterCard === 'summary_large_image' && !imageUrl) {
		issues.push('Large-image card configured but no valid preview image URL');
	}

	return {
		title: title?.trim() || null,
		description: description?.trim() || null,
		image: image?.trim() || null,
		imageUrl,
		twitterCard: twitterCard?.trim() || null,
		issues,
		ready: issues.length === 0
	};
}

/** Apply live HEAD result for og:image — call after fetch. */
export function applyOgImageReachability(
	preview: SocialPreview,
	reachable: boolean | null,
	contentType?: string | null
): SocialPreview {
	if (reachable === null || !preview.imageUrl) {
		return { ...preview, imageReachable: reachable };
	}

	const issues = [...preview.issues];
	if (!reachable) {
		issues.push('og:image URL failed to load — link previews will show a broken or empty card');
	} else if (contentType && !contentType.split(';')[0]?.trim().toLowerCase().startsWith('image/')) {
		issues.push(
			`og:image returned ${contentType.split(';')[0]} — not an image (common SPA fallback bug)`
		);
	}

	return {
		...preview,
		imageReachable: reachable,
		issues,
		ready: issues.length === 0
	};
}
