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

	it('flags unreachable og:image after HEAD check', () => {
		const preview = buildSocialPreview(HTML, new URL('https://app.test/'));
		const updated = applyOgImageReachability(preview, false);
		expect(updated.ready).toBe(false);
		expect(updated.imageReachable).toBe(false);
		expect(updated.issues.some((i) => i.includes('failed to load'))).toBe(true);
	});
});
