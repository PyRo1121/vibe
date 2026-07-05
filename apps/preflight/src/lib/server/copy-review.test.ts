import { describe, expect, it } from 'vitest';

import { buildCopyReview, parseCopyReview } from './copy-review';

const VALID_JSON =
	'{"bullets":["Headline says nothing about who it is for","CTA is below the fold"],"headline":"Ship your launch with confidence","subhead":"One scan catches the mistakes strangers screenshot."}';

describe('parseCopyReview', () => {
	it('parses strict JSON', () => {
		const review = parseCopyReview(VALID_JSON);
		expect(review?.bullets).toHaveLength(2);
		expect(review?.headline).toBe('Ship your launch with confidence');
	});

	it('extracts JSON wrapped in model chatter', () => {
		const review = parseCopyReview(`Sure! Here is the review:\n${VALID_JSON}\nHope that helps.`);
		expect(review?.subhead).toContain('One scan');
	});

	it('rejects garbage, empty bullets, and missing headline', () => {
		expect(parseCopyReview('not json at all')).toBeNull();
		expect(parseCopyReview('{"bullets":[],"headline":"x","subhead":"y"}')).toBeNull();
		expect(parseCopyReview('{"bullets":["a"],"subhead":"y"}')).toBeNull();
	});

	it('caps bullet count and lengths', () => {
		const long = JSON.stringify({
			bullets: ['a', 'b', 'c', 'd', 'e', 'f'],
			headline: 'h'.repeat(500),
			subhead: 's'
		});
		const review = parseCopyReview(long);
		expect(review?.bullets).toHaveLength(4);
		expect(review?.headline.length).toBeLessThanOrEqual(120);
	});
});

describe('buildCopyReview', () => {
	const input = { url: 'https://app.test', title: 't', description: 'd', topIssues: [] };

	it('returns parsed review from a { response } payload', async () => {
		const ai = { run: async () => ({ response: VALID_JSON }) };
		const review = await buildCopyReview(ai, input);
		expect(review?.bullets.length).toBeGreaterThan(0);
	});

	it('returns null when the model errors or returns junk', async () => {
		expect(
			await buildCopyReview(
				{
					run: async () => {
						throw new Error('model down');
					}
				},
				input
			)
		).toBeNull();
		expect(await buildCopyReview({ run: async () => ({ response: 'nope' }) }, input)).toBeNull();
	});
});
