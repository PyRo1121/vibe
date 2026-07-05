/**
 * AI landing-copy review via Workers AI. Only runs for unlocked (paid) scans,
 * which keeps usage far inside the free 10k neurons/day allocation. Every
 * failure path returns null — the scan must never depend on the model.
 */

export interface CopyReview {
	bullets: string[];
	headline: string;
	subhead: string;
}

export interface AiRunner {
	run(model: string, options: Record<string, unknown>): Promise<unknown>;
}

// fp8 variant — the only Llama 3.1 8B available on this account, and cheaper in neurons.
const MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';
const TIMEOUT_MS = 12_000;
const MAX_BULLETS = 4;

export interface CopyReviewInput {
	url: string;
	title: string | null;
	description: string | null;
	topIssues: string[];
}

function buildPrompt(input: CopyReviewInput): string {
	return [
		'You are a landing page copy expert reviewing a site before its public launch.',
		`URL: ${input.url}`,
		`Current title tag: ${input.title ?? '(missing)'}`,
		`Current meta description: ${input.description ?? '(missing)'}`,
		input.topIssues.length > 0 ? `Known issues: ${input.topIssues.join('; ')}` : '',
		'',
		'Respond with STRICT JSON only, no markdown, exactly this shape:',
		'{"bullets":["specific critique 1","critique 2","critique 3"],"headline":"rewritten hero headline","subhead":"rewritten one-sentence subhead"}',
		'Rules: bullets are concrete and specific to this site (never generic advice), max 3 bullets, headline under 10 words, subhead under 25 words.'
	]
		.filter(Boolean)
		.join('\n');
}

/** Pure and unit-testable: extracts a CopyReview from raw model output. */
export function parseCopyReview(raw: string): CopyReview | null {
	const start = raw.indexOf('{');
	const end = raw.lastIndexOf('}');
	if (start === -1 || end <= start) return null;

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw.slice(start, end + 1));
	} catch {
		return null;
	}
	if (typeof parsed !== 'object' || parsed === null) return null;

	const obj = parsed as Record<string, unknown>;
	const bullets = Array.isArray(obj.bullets)
		? obj.bullets
				.filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
				.map((b) => b.trim().slice(0, 300))
				.slice(0, MAX_BULLETS)
		: [];
	const headline = typeof obj.headline === 'string' ? obj.headline.trim().slice(0, 120) : '';
	const subhead = typeof obj.subhead === 'string' ? obj.subhead.trim().slice(0, 250) : '';

	if (bullets.length === 0 || !headline) return null;
	return { bullets, headline, subhead };
}

export async function buildCopyReview(
	ai: AiRunner,
	input: CopyReviewInput
): Promise<CopyReview | null> {
	try {
		const result = await Promise.race([
			ai.run(MODEL, {
				messages: [{ role: 'user', content: buildPrompt(input) }],
				max_tokens: 512
			}),
			new Promise<never>((_resolve, reject) =>
				setTimeout(() => reject(new Error('AI timeout')), TIMEOUT_MS)
			)
		]);

		const text =
			typeof result === 'string'
				? result
				: typeof (result as { response?: unknown })?.response === 'string'
					? (result as { response: string }).response
					: null;
		return text ? parseCopyReview(text) : null;
	} catch {
		return null;
	}
}
