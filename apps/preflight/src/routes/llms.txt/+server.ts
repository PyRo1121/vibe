import type { RequestHandler } from './$types';
import { DEFAULT_DEPLOYLINT_API } from '@vibe/deploylint-shared';

const BODY = `# Deploylint

> Launch-readiness audit for vibe-coded apps — GO/NO-GO before you post a URL publicly.

Deploylint scans a live URL for launch blockers: exposed secrets in JS bundles, broken social preview images, placeholder copy, missing legal pages, robots.txt blocking Google, llms.txt, security.txt, security headers, and more.

- Product: ${DEFAULT_DEPLOYLINT_API}
- Free tier: verdict, embarrassment brief, social preview, one sample fix prompt
- Paid ($9): all fix prompts, master repair paste, unlimited re-scans with score delta
- CI gate: ${DEFAULT_DEPLOYLINT_API}/developers — block deploys when launch blockers remain

Built for builders using Cursor, Lovable, Bolt, and similar tools who ship fast and hate public surprises.
`;

export const GET: RequestHandler = async () =>
	new Response(BODY, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=300'
		}
	});
