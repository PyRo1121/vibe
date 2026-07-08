import { describe, expect, it } from 'vitest';

import { buildSocialPreview, applyOgImageReachability } from './social';

const HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Fallback Title</title>
  <meta property="og:title" content="OG Title">
  <meta property="og:description" content="A short description for social sharing.">
  <meta property="og:image" content="/og.png">
  <meta name="twitter:card" content="summary_large_image">
</head>
<body></body>
</html>`;

describe('buildSocialPreview', () => {
	it('resolves absolute image url', () => {
		const preview = buildSocialPreview(HTML, new URL('https://app.test/'));
		expect(preview.title).toBe('OG Title');
		expect(preview.imageUrl).toBe('https://app.test/og.png');
		expect(preview.ready).toBe(true);
	});

	it('flags missing og:image', () => {
		const html = '<html><head><title>Only title</title></head></html>';
		const preview = buildSocialPreview(html, new URL('https://app.test/'));
		expect(preview.ready).toBe(false);
		expect(preview.issues.some((i) => i.includes('og:image'))).toBe(true);
	});

	it('flags missing title, description, and twitter card metadata', () => {
		const preview = buildSocialPreview(
			'<html><head></head><body></body></html>',
			new URL('https://app.test/')
		);

		expect(preview.title).toBeNull();
		expect(preview.description).toBeNull();
		expect(preview.twitterCard).toBeNull();
		expect(preview.issues).toEqual(
			expect.arrayContaining([
				'Missing preview title (og:title or <title>)',
				'Missing preview description',
				'Missing og:image — Slack and X previews will look empty'
			])
		);
	});

	it('flags preview copy that is likely to truncate', () => {
		const html = `<!doctype html><html><head>
			<title>${'Launch readiness headline '.repeat(5)}</title>
			<meta name="description" content="${'A detailed product positioning sentence '.repeat(8)}">
			<meta property="og:image" content="/og.png">
		</head></html>`;

		const preview = buildSocialPreview(html, new URL('https://app.test/'));

		expect(preview.issues).toEqual(
			expect.arrayContaining([
				'Preview title may truncate on mobile (keep under ~70 chars)',
				'Preview description may truncate (aim for 120–160 chars)',
				'Missing twitter:card — X may show a plain link instead of a card'
			])
		);
	});

	it('flags invalid large-card image URLs', () => {
		const html = `<!doctype html><html><head>
			<meta property="og:title" content="Ready">
			<meta property="og:description" content="Good preview copy.">
			<meta property="og:image" content="http://[">
			<meta name="twitter:card" content="summary_large_image">
		</head></html>`;

		const preview = buildSocialPreview(html, new URL('https://app.test/'));

		expect(preview.imageUrl).toBeNull();
		expect(preview.ready).toBe(false);
		expect(preview.issues).toEqual(
			expect.arrayContaining([
				'og:image URL is invalid or relative without a base',
				'Large-image card configured but no valid preview image URL'
			])
		);
	});

	it('flags unreachable og:image after HEAD check', () => {
		const preview = buildSocialPreview(HTML, new URL('https://app.test/'));
		const updated = applyOgImageReachability(preview, false);
		expect(updated.ready).toBe(false);
		expect(updated.imageReachable).toBe(false);
		expect(updated.issues.some((i) => i.includes('failed to load'))).toBe(true);
	});

	it('keeps reachable images ready and flags non-image responses', () => {
		const preview = buildSocialPreview(HTML, new URL('https://app.test/'));

		const reachable = applyOgImageReachability(preview, true, 'image/png; charset=utf-8');
		expect(reachable.ready).toBe(true);
		expect(reachable.imageReachable).toBe(true);

		const fallback = applyOgImageReachability(preview, true, 'text/html; charset=utf-8');
		expect(fallback.ready).toBe(false);
		expect(fallback.issues.some((issue) => issue.includes('not an image'))).toBe(true);
	});

	it('records skipped reachability checks without mutating readiness', () => {
		const preview = buildSocialPreview(
			'<html><head><title>Only title</title></head></html>',
			new URL('https://app.test/')
		);
		const updated = applyOgImageReachability(preview, null);

		expect(updated.imageReachable).toBeNull();
		expect(updated.ready).toBe(preview.ready);
		expect(updated.issues).toEqual(preview.issues);
	});
});
