export interface SeoLandingSection {
	heading: string;
	body: string;
}

export interface SeoLandingFaq {
	question: string;
	answer: string;
}

export interface SeoLandingPage {
	slug: string;
	navLabel: string;
	title: string;
	description: string;
	h1: string;
	kicker: string;
	searchIntent: string;
	primaryCta: string;
	sections: readonly SeoLandingSection[];
	faq: readonly SeoLandingFaq[];
}

export const SEO_LANDING_PAGES = [
	{
		slug: 'launch-readiness-checker',
		navLabel: 'Launch readiness checker',
		title: 'Launch readiness checker for websites and AI-built apps',
		description:
			'Run a prelaunch website scan for SEO, social previews, security headers, exposed secrets, legal pages, and launch blockers before you share a URL.',
		h1: 'Launch readiness checker for websites you are about to share',
		kicker: 'Prelaunch website scan',
		searchIntent:
			'Use this when you need to know whether a public URL is safe to post on Product Hunt, Reddit, X, LinkedIn, or a customer call before launch traffic arrives.',
		primaryCta: 'Run a free launch scan',
		sections: [
			{
				heading: 'Catch public launch blockers first',
				body: 'Deploylint checks the visible URL for missing titles, broken previews, noindex mistakes, missing legal pages, exposed deployment surfaces, and security header gaps.'
			},
			{
				heading: 'Turn failures into fix prompts',
				body: 'Every high-signal finding is written for developers who want a concrete repair step, not another vague audit score.'
			},
			{
				heading: 'Re-scan before you announce',
				body: 'Run the same URL again after fixes so you can see whether the score, verdict, and launch blockers actually changed.'
			}
		],
		faq: [
			{
				question: 'What does a launch readiness checker look for?',
				answer:
					'It checks the public URL for practical launch risks: SEO metadata, social previews, robots rules, legal pages, security headers, exposed files, service readiness, and copy polish.'
			},
			{
				question: 'Is Deploylint a replacement for Lighthouse?',
				answer:
					'No. Lighthouse is excellent for performance and accessibility lab signals. Deploylint focuses on public launch blockers and agent-ready fixes.'
			},
			{
				question: 'Is the scanner free during alpha?',
				answer:
					'Yes. Full scan output is free during alpha while Deploylint is being developed, and some checks may change or break during that period.'
			}
		]
	},
	{
		slug: 'ai-app-launch-checker',
		navLabel: 'AI app launch checker',
		title: 'AI app launch checker for Cursor, Lovable, and Bolt projects',
		description:
			'Scan an AI-built app before launch for exposed secrets, broken Open Graph cards, noindex mistakes, missing policies, auth friction, payment readiness, and service health.',
		h1: 'AI app launch checker for vibe-coded products',
		kicker: 'AI-built app QA',
		searchIntent:
			'Use this when an AI-assisted app looks done in the editor, but you still need to catch public deployment mistakes before users see them.',
		primaryCta: 'Check an AI-built app',
		sections: [
			{
				heading: 'Built for fast shipping loops',
				body: 'Deploylint assumes you are iterating quickly in Cursor, Lovable, Bolt, Claude, or a similar tool and need a blunt public-readiness pass.'
			},
			{
				heading: 'Find AI-app failure modes',
				body: 'The scan looks for placeholder copy, missing favicon and app polish, broken social cards, exposed environment files, security headers, and launch-critical routes.'
			},
			{
				heading: 'Copy fixes back into your agent',
				body: 'Findings are shaped so you can paste clear instructions back into your coding agent and re-scan the deployed URL after changes land.'
			}
		],
		faq: [
			{
				question: 'Can Deploylint scan apps made with AI builders?',
				answer:
					'Yes. It scans the deployed public URL, so it works whether the app was made by hand, with Cursor, with Lovable, with Bolt, or with another builder.'
			},
			{
				question: 'Does Deploylint need my repository access?',
				answer:
					'No for the website scan. The public scanner only needs a URL. Repository and GitHub tooling can come later as a separate opt-in workflow.'
			},
			{
				question: 'What makes AI-built apps risky at launch?',
				answer:
					'AI-built apps often ship fast but miss public basics: real metadata, legal pages, auth copy, service readiness, social previews, and accidental exposed files.'
			}
		]
	},
	{
		slug: 'vibe-code-launch-checklist',
		navLabel: 'Vibe code launch checklist',
		title: 'Vibe code launch checklist for shipping a public website',
		description:
			'Use this vibe code launch checklist to catch SEO, social preview, security, legal, support, and payment-readiness mistakes before you publish your URL.',
		h1: 'Vibe code launch checklist before you post the URL',
		kicker: 'Launch checklist',
		searchIntent:
			'Use this when the product is close enough to share, but you want a concrete checklist for the public details that are easy to miss when moving fast.',
		primaryCta: 'Run the checklist scan',
		sections: [
			{
				heading: 'Check the page people will share',
				body: 'Make sure the home page has a real title, description, canonical URL, headings, social preview image, favicon, and readable value proposition.'
			},
			{
				heading: 'Check the trust basics',
				body: 'Before launch, confirm privacy, terms, support paths, security headers, safe robots rules, and no exposed deployment files.'
			},
			{
				heading: 'Check the buyer path',
				body: 'If the product has pricing, auth, checkout, email, or waitlist flows, the checklist should verify that users can understand the next action.'
			}
		],
		faq: [
			{
				question: 'What should be on a vibe code launch checklist?',
				answer:
					'Start with public basics: SEO metadata, social previews, legal pages, support paths, security headers, exposed files, service status, checkout clarity, and obvious placeholder copy.'
			},
			{
				question: 'Why use a scanner instead of a manual checklist?',
				answer:
					'A manual checklist is useful, but a scanner catches repeatable mistakes quickly and gives you a consistent before-and-after result after fixes.'
			},
			{
				question: 'Can I use this before a Product Hunt launch?',
				answer:
					'Yes. Deploylint is designed for the moment before you post a URL publicly and want the embarrassing issues surfaced first.'
			}
		]
	}
] as const satisfies readonly SeoLandingPage[];

export function getSeoLandingPage(slug: string): SeoLandingPage | null {
	return SEO_LANDING_PAGES.find((page) => page.slug === slug) ?? null;
}
