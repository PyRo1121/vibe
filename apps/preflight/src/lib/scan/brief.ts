import { scoreChecks } from '$lib/scan/score';
import type { CategoryScore, LaunchBrief, ScanCheck, ScanReport } from '$lib/scan/types';
import { resolvePriority } from '$lib/scan/verdict';
import { categoryLabels } from '$lib/ui/scan-styles';

const EMBARRASSMENT: Record<string, string> = {
	privacy: 'Someone will ask where your privacy policy is before they trust you.',
	terms: 'Paid products without terms look amateur when a buyer asks.',
	secrets: 'Exposed keys get scraped within hours — rotate immediately.',
	'open-graph': 'Your link will look broken when pasted on X, Slack, or Discord.',
	'og-image-live': 'Your share card image 404s — X and Slack will show an empty box.',
	'og-image-type': 'og:image returns HTML instead of a picture — social cards look broken.',
	'robots-block': 'robots.txt tells Google to stay away — you will launch to zero search traffic.',
	'placeholder-copy': 'Template TODO or Lorem ipsum on a live page screams unfinished product.',
	'llms-txt': 'AI assistants may summarize your product wrong without llms.txt context.',
	'security-txt':
		'No security.txt — researchers and enterprise buyers cannot find a disclosure path.',
	noindex: 'Search engines are told not to index this page — fatal for a public launch.',
	https: 'Browsers will warn visitors your site is insecure.',
	reachable: 'Your homepage does not load — every share link goes to an error.',
	fetch: 'Your homepage does not load — every share link goes to an error.',
	viewport: 'Mobile visitors will see a broken layout in the first screenshot.',
	title: 'Tab title and link previews will look generic or empty.',
	description: 'Google and social previews will invent copy for you — badly.',
	links: 'Dead links in nav/footer are the first thing critics click.',
	'hsts-header': 'Missing HSTS — first visit can be downgraded before redirect.',
	'permissions-policy-header':
		'No Permissions-Policy — camera/mic/geo are not explicitly denied for embeds.',
	'page-weight': 'Slow first paint makes Product Hunt comments mention performance.',
	'twitter-card': 'X may render a plain URL instead of a rich card.',
	canonical: 'Duplicate URLs split SEO and confuse crawlers.',
	'license-risk':
		'A library license may forbid selling this product — copyleft or non-commercial terms found.',
	'env-committed':
		'A committed .env file hands your API keys to anyone who clones the repo — scrapers find these in minutes.',
	'gitignore-env': 'Without .env in .gitignore, one careless commit publishes every secret.',
	'repo-license': 'License questions kill deals — buyers and contributors check this first.',
	readme: 'An empty README makes the project look abandoned to anyone who finds it.',
	'img-alt': 'Accessibility callouts spread fast on launch threads.',
	'response-time': 'A slow first load is the first thing Product Hunt commenters mention.',
	'not-found-page':
		'Every broken link silently shows your homepage — you will never know what is dead.',
	'email-auth': 'Password resets landing in spam means signups you paid for never activate.',
	'dkim-dns': 'SPF without DKIM still gets spam-foldered by Gmail and Outlook on many sends.',
	'form-security':
		'A form posts over plain HTTP — browsers flag it and credentials transit unencrypted.',
	'exposed-env': 'A public /.env download hands live credentials to anyone with curl.',
	'exposed-git': 'Exposed .git lets attackers download your entire source history.',
	'exposed-backup': 'A public backup.zip is a gift-wrapped data breach waiting to happen.',
	'dead-social-links': 'Placeholder social icons (twitter.com with no handle) scream "template".',
	'default-favicon-title':
		'A "Vite App" tab title is the #1 screenshot on launch-day mockery threads.',
	'broken-anchor-nav':
		'Nav links that scroll nowhere make the site feel broken in the first 10 seconds.',
	'copyright-year': 'A stale footer year reads as an abandoned project.',
	'ai-crawlers': 'robots.txt blocks GPTBot/ClaudeBot — your product cannot appear in AI answers.',
	'primary-cta': 'Visitors have no obvious next step — launch traffic bounces in seconds.',
	'pricing-path': 'No pricing signal — "how much?" goes unanswered and buyers assume the worst.',
	'social-proof': 'Zero social proof — nothing tells a stranger this product is real and used.',
	sri: 'Third-party scripts load without integrity hashes — a compromised CDN owns your page.',
	'ci-config': 'No CI — every deploy is a manual gamble.',
	'tests-present': 'No tests — you cannot accept AI-generated changes safely.',
	'lockfile-committed': 'No lockfile — every install may pull different versions than you shipped.'
};

export function embarrassmentLine(check: ScanCheck): string {
	return EMBARRASSMENT[check.id] ?? `${check.title}: ${check.message}`;
}

export function scoreByCategory(checks: ScanCheck[]): CategoryScore[] {
	const categories = [...new Set(checks.map((c) => c.category))];
	return categories
		.map((category) => {
			const items = checks.filter((c) => c.category === category);
			return {
				category,
				label: categoryLabels[category] ?? category,
				score: scoreChecks(items),
				fail: items.filter((c) => c.status === 'fail').length,
				warn: items.filter((c) => c.status === 'warn').length,
				pass: items.filter((c) => c.status === 'pass').length
			};
		})
		.toSorted((a, b) => a.score - b.score);
}

export function buildLaunchBrief(report: ScanReport): LaunchBrief {
	if (report.scanCoverage === 'blocked') {
		const reachable = report.checks.find((c) => c.id === 'reachable' || c.id === 'fetch');
		return {
			headline: 'Scan incomplete — we could not read your real homepage.',
			embarrassmentRisks: reachable
				? [
						'Results below are from an error or bot-block page — not your actual site.',
						embarrassmentLine(reachable)
					]
				: ['Content checks were skipped because the homepage did not return HTTP 200.'],
			shareReady: false,
			categoryScores: scoreByCategory(report.checks)
		};
	}

	const failing = report.checks.filter((c) => c.status === 'fail');
	const p0Fails = failing.filter((c) => resolvePriority(c) === 'p0');
	const embarrassmentRisks = [...failing, ...report.checks.filter((c) => c.status === 'warn')]
		.toSorted((a, b) => {
			const rank = { fail: 0, warn: 1, pass: 2 };
			return rank[a.status] - rank[b.status];
		})
		.slice(0, 5)
		.map(embarrassmentLine);

	let headline: string;
	if (report.verdict === 'go') {
		headline = 'Ready to share — polish optional items before a big launch.';
	} else if (p0Fails.length > 0) {
		headline = `${p0Fails.length} launch blocker${p0Fails.length === 1 ? '' : 's'} — fix before posting publicly.`;
	} else {
		headline = 'Almost there — fix important issues before Product Hunt or Reddit.';
	}

	return {
		headline,
		embarrassmentRisks,
		shareReady: report.socialPreview?.ready ?? false,
		categoryScores: scoreByCategory(report.checks)
	};
}
