export interface GuideSection {
	heading: string;
	body: string;
	bullets: string[];
}

export interface GuideFaq {
	question: string;
	answer: string;
}

export interface GuidePage {
	slug: string;
	navTitle: string;
	title: string;
	description: string;
	eyebrow: string;
	h1: string;
	intro: string;
	sections: GuideSection[];
	checklist: string[];
	faq: GuideFaq[];
}

export const GUIDES = [
	{
		slug: 'ai-app-launch-checker',
		navTitle: 'AI deploy checker',
		title: 'AI app deploy-readiness checker for vibe-coded products',
		description:
			'Use Deploylint to check AI-built apps for deploy blockers, CI gaps, security leaks, legal gaps, SEO mistakes, and broken social previews before production.',
		eyebrow: 'AI app deploy readiness',
		h1: 'AI app deploy-readiness checker',
		intro:
			'AI-built apps ship quickly, but the same speed makes production mistakes easy: exposed env files, thin metadata, broken previews, missing legal pages, placeholder copy, and weak CI gates. Deploylint checks the deploy surface before risky changes reach users.',
		sections: [
			{
				heading: 'What Deploylint checks first',
				body: 'Deploylint focuses on deploy blockers rather than abstract audit scores. It fetches the live target, follows redirects, reads crawler surfaces, samples public assets, inspects repo signals when available, and turns findings into a GO, CONDITIONAL, or NO-GO verdict.',
				bullets: [
					'Indexing blockers such as noindex tags or robots.txt disallow rules',
					'Social preview tags and og:image content-type mistakes',
					'Public .env, .git, source-map, and JavaScript secret exposure',
					'Missing privacy, terms, security.txt, sitemap.xml, and llms.txt signals'
				]
			},
			{
				heading: 'Why this is different from Lighthouse',
				body: 'Lighthouse is useful for performance and accessibility lab work. Deploylint answers a different deploy question: what would block a small team from safely treating this target as production-ready?',
				bullets: [
					'Deploy verdicts instead of only lab scores',
					'Fix prompts that can be pasted into Cursor or another coding agent',
					'Re-scan proof so a builder can show deploy risk went down'
				]
			}
		],
		checklist: [
			'Run the production URL, not localhost or a private preview.',
			'Fix every P0 issue before enabling gate mode.',
			'Re-scan after fixes and save the report link.',
			'Wire the CI gate before the next production push.'
		],
		faq: [
			{
				question: 'Can Deploylint guarantee Google indexing?',
				answer:
					'No. It can make the public site crawlable and catch common blockers, but Google still decides when and whether to index a URL.'
			},
			{
				question: 'Should AI-built apps still use Search Console?',
				answer:
					'Yes. Search Console is still the source for Google indexing state, sitemap processing, and query impressions.'
			}
		]
	},
	{
		slug: 'website-launch-checklist',
		navTitle: 'Deploy checklist',
		title: 'Deploy readiness checklist for small SaaS products',
		description:
			'Run a practical deploy readiness checklist for SEO, security headers, legal pages, social previews, crawler access, CI gates, and conversion basics.',
		eyebrow: 'Production readiness checklist',
		h1: 'Deploy readiness checklist',
		intro:
			'A small SaaS deploy needs more than a working homepage. The production target has to be reachable, understandable, shareable, indexable, and safe enough that early users can trust it.',
		sections: [
			{
				heading: 'Technical discovery',
				body: 'Search engines and AI crawlers need plain, canonical pages that can be fetched without login or preview-only access.',
				bullets: [
					'HTTPS canonical URL with www and HTTP redirects cleaned up',
					'robots.txt that allows the public site and references sitemap.xml',
					'sitemap.xml with only canonical, public pages',
					'Unique title, meta description, canonical URL, Open Graph, and JSON-LD per public page'
				]
			},
			{
				heading: 'Trust and deploy safety',
				body: 'Early users click legal, pricing, and security signals before they trust a new product. Deploylint treats missing trust surfaces as deploy risk, not polish.',
				bullets: [
					'Privacy and terms pages linked from the footer',
					'No exposed secrets, dotenv files, or repository metadata',
					'Security headers and a security.txt contact path',
					'Readable above-the-fold copy that names the product category'
				]
			}
		],
		checklist: [
			'Submit the sitemap in Google Search Console and Bing Webmaster Tools.',
			'Inspect the homepage, check catalog, comparison, developer, and changelog URLs.',
			'Add IndexNow for Bing-compatible discovery.',
			'Publish one or two useful pages for each real search intent, not doorway pages.'
		],
		faq: [
			{
				question: 'How many pages does a new SaaS need for SEO?',
				answer:
					'Start with a crawlable homepage, comparison page, check catalog or docs page, changelog, and a few useful guides tied to real search intent.'
			},
			{
				question: 'Do directory submissions matter?',
				answer:
					'Only a small number of relevant, reputable listings are worth the effort. Broad automated submissions are low signal and can become spam.'
			}
		]
	},
	{
		slug: 'lighthouse-alternative',
		navTitle: 'Lighthouse alternative',
		title: 'Deploylint vs Lighthouse for CI hardening',
		description:
			'Compare Deploylint and Lighthouse: Lighthouse measures lab performance, while Deploylint checks deploy blockers, CI gaps, SEO visibility, social previews, and agent-ready fixes.',
		eyebrow: 'Lighthouse alternative',
		h1: 'Deploylint vs Lighthouse',
		intro:
			'Lighthouse is still useful. Deploylint is not trying to replace it. Deploylint covers deploy-readiness and CI-hardening issues that Lighthouse does not prioritize for a small builder shipping with agents.',
		sections: [
			{
				heading: 'Use Lighthouse for lab performance',
				body: 'Lighthouse is strongest when you need Core Web Vitals estimates, accessibility audits, best practices, and performance diagnostics from a controlled browser run.',
				bullets: [
					'Largest Contentful Paint, Total Blocking Time, and Cumulative Layout Shift',
					'Image, JavaScript, and render-blocking diagnostics',
					'Accessibility and best-practice checks'
				]
			},
			{
				heading: 'Use Deploylint before gate mode',
				body: 'Deploylint looks for risks that make a production deploy invisible, unsafe, or untrustworthy even when the page is fast.',
				bullets: [
					'Noindex, robots, sitemap, canonical, and social preview problems',
					'Exposed secrets, .env files, .git metadata, source maps, and weak deploy security',
					'Missing legal pages, security.txt, llms.txt, and agent-ready fix prompts'
				]
			}
		],
		checklist: [
			'Run Lighthouse for performance regressions.',
			'Run Deploylint for deploy blockers and public trust gaps.',
			'Fix P0 Deploylint issues before optimizing P2 polish.',
			'Keep both reports when preparing a serious production rollout.'
		],
		faq: [
			{
				question: 'Is Deploylint a Lighthouse replacement?',
				answer:
					'No. Deploylint complements Lighthouse by focusing on deploy blockers, crawler visibility, trust, CI hardening, and agent-ready fixes.'
			},
			{
				question: 'Which tool should run in CI?',
				answer:
					'Run both when possible. Use Lighthouse for performance budgets and Deploylint for GO/NO-GO deploy readiness.'
			}
		]
	}
] as const satisfies readonly GuidePage[];

export function getGuide(slug: string): GuidePage | null {
	return GUIDES.find((guide) => guide.slug === slug) ?? null;
}
