export interface CheckCatalogEntry {
	id: string;
	why: string;
	detectedBy: string;
	falsePositive?: string;
}

export const CHECK_CATALOG = {
	'ai-client-api': {
		id: 'ai-client-api',
		why: 'Client-side AI API calls often turn into leaked provider keys, runaway spend, and no abuse controls. Launch apps should proxy AI calls through a server boundary.',
		detectedBy:
			'Looks for OpenAI, Anthropic, Replicate, or Hugging Face API/provider signatures in rendered homepage or crawled page HTML.',
		falsePositive:
			'This can be okay if the page only contains public docs links or the actual provider call is authenticated through your own server endpoint.'
	},
	'ai-crawlers': {
		id: 'ai-crawlers',
		why: 'AI crawler access now affects whether products appear in answer engines, research tools, and assistant-generated recommendations.',
		detectedBy:
			'Fetches robots.txt and evaluates known AI crawlers such as GPTBot, ClaudeBot, PerplexityBot, Google-Extended, and CCBot.',
		falsePositive:
			'Blocking AI crawlers can be intentional for private products or licensing reasons; public marketing sites should make that choice deliberately.'
	},
	'answer-signals': {
		id: 'answer-signals',
		why: 'Clear summaries help search engines and AI assistants quote the product accurately instead of inventing a vague description from scattered copy.',
		detectedBy:
			'Looks for a usable meta description, FAQ structured data, or concise text near the primary H1 that can act as a citable product summary.',
		falsePositive:
			'Minimal landing pages may be intentionally terse, but they still need one plain-language sentence explaining what the product does.'
	},
	'auth-provider': {
		id: 'auth-provider',
		why: 'Auth is a launch-critical boundary: bad redirect URLs, wrong production keys, or loose sessions can lock users out or expose account data.',
		detectedBy:
			'Looks for Clerk, Auth0, or WorkOS browser/package signatures in rendered homepage or crawled page HTML.',
		falsePositive:
			'Marketing-only pages may load auth widgets for signup buttons even when the protected app lives on another subdomain.'
	},
	canonical: {
		id: 'canonical',
		why: 'Canonical URLs keep duplicate homepage variants from splitting ranking signals, previews, analytics, and search-result attribution.',
		detectedBy:
			'Reads the canonical link tag and compares it with the final scanned URL after redirects and trailing-slash normalization.',
		falsePositive:
			'Canonicalizing to another URL can be correct for mirrors or regional pages, but the target should be intentional and reachable.'
	},
	'charset-meta': {
		id: 'charset-meta',
		why: 'A declared UTF-8 charset prevents mojibake in search snippets, social previews, and browsers that guess encoding from partial content.',
		detectedBy: 'Checks rendered HTML for a UTF-8 charset declaration in the document head.',
		falsePositive:
			'Servers can declare charset in Content-Type, but an in-document declaration is cheap insurance for static and cached pages.'
	},
	clarity: {
		id: 'clarity',
		why: 'Launch pages need an immediately understandable title, description, and headline so visitors, search engines, and AI tools know what is being offered.',
		detectedBy:
			'Scores the title, meta description, and H1 for basic length and presence signals that indicate clear positioning.',
		falsePositive:
			'Experimental copy can be intentionally short or mysterious, but paid acquisition and search traffic usually need plain positioning.'
	},
	'clickjack-header': {
		id: 'clickjack-header',
		why: 'Clickjacking protections stop other sites from framing your app and tricking users into clicking destructive or account-changing UI.',
		detectedBy:
			'Checks for X-Frame-Options or a Content-Security-Policy frame-ancestors directive on HTTPS responses.',
		falsePositive:
			'Embedding may be intentional for widgets or dashboards; frame-ancestors should explicitly allow only trusted parent origins.'
	},
	'csp-header': {
		id: 'csp-header',
		why: 'A Content Security Policy reduces the blast radius of XSS by limiting which scripts, frames, images, and network targets the page can use.',
		detectedBy: 'Checks whether the HTTPS response includes a Content-Security-Policy header.',
		falsePositive:
			'Add a report-only policy first if the product is changing quickly and immediate enforcement would be risky.'
	},
	'dependency-vulns': {
		id: 'dependency-vulns',
		why: 'Known vulnerable dependencies are one of the fastest ways for a launch to inherit public CVEs before the product has any operational maturity.',
		detectedBy:
			'Parses supported lockfiles from public GitHub repositories and queries OSV for package/version advisories.',
		falsePositive:
			'Some advisories affect only unused code paths; keep the finding visible until the package is upgraded, removed, or the advisory is explicitly not applicable.'
	},
	description: {
		id: 'description',
		why: 'A useful meta description improves search snippets, share previews, and AI summaries by giving crawlers a concise description of the page.',
		detectedBy:
			'Reads the homepage meta description and checks whether it is present with enough substance to summarize the product.',
		falsePositive:
			'Some search engines rewrite descriptions, but missing or thin descriptions still leave crawlers with weaker source material.'
	},
	'duplicate-meta': {
		id: 'duplicate-meta',
		why: 'Duplicate titles and descriptions make crawled pages compete with each other and create bland search results that users cannot distinguish.',
		detectedBy:
			'Compares homepage title and description with crawled internal pages to find repeated title-plus-description pairs.',
		falsePositive:
			'Small one-page sites may have few unique pages; once multiple routes exist, each important page should explain its distinct purpose.'
	},
	'env-committed': {
		id: 'env-committed',
		why: 'Committed env files turn private configuration into repository history. Even after deletion, old commits can keep secrets recoverable.',
		detectedBy:
			'Public GitHub repo scans sample repository files and flag committed .env-style files outside safe examples.',
		falsePositive:
			'An intentionally empty .env.example is fine; real .env files with values should never be committed.'
	},
	'error-monitoring': {
		id: 'error-monitoring',
		why: 'Production error monitoring turns launch failures into visible alerts instead of silent user churn. It is a positive readiness signal, not just a vendor chip.',
		detectedBy:
			'Looks for Sentry or LogRocket browser signatures in rendered homepage or crawled page HTML.',
		falsePositive:
			'The script can be present but misconfigured; verify a test exception reaches the production project before relying on it.'
	},
	'exposed-env': {
		id: 'exposed-env',
		why: 'A public dotenv file usually means live credentials are downloadable by anyone. Treat every value in it as compromised.',
		detectedBy:
			'Probes common same-origin dotenv paths such as /.env and checks whether they return reachable secret-like content.',
		falsePositive:
			'A honeypot or empty placeholder file can still be confusing to scanners and attackers; remove it from the public web root.'
	},
	'exposed-git': {
		id: 'exposed-git',
		why: 'An exposed .git directory can reveal source code, commit history, and secrets that were removed from the current working tree.',
		detectedBy: 'Probes same-origin /.git/HEAD and related metadata paths for public reachability.',
		falsePositive:
			'Rarely intentional. If this is a static decoy, block it anyway so automated exploit tooling does not treat the host as vulnerable.'
	},
	fetch: {
		id: 'fetch',
		why: 'If Deploylint cannot fetch the target, it cannot judge SEO, legal, social preview, security headers, or app readiness with confidence.',
		detectedBy:
			'Runs the initial public fetch for the submitted URL and records network failures or blocked scanner responses.',
		falsePositive:
			'Bot-protected enterprise sites may block scanners intentionally. For your own launch, test a staging URL that allows automated fetches.'
	},
	'form-security': {
		id: 'form-security',
		why: 'Insecure forms can leak credentials or personal data, especially when HTTPS pages submit to HTTP endpoints or password fields appear on HTTP pages.',
		detectedBy:
			'Scans rendered HTML forms for insecure actions and password fields on non-HTTPS pages.',
		falsePositive:
			'Static demo forms can still scare browsers and users; remove them or make the action relative/HTTPS before launch.'
	},
	h1: {
		id: 'h1',
		why: 'A single clear H1 gives visitors, assistive technology, and search crawlers the primary topic of the page without guessing.',
		detectedBy:
			'Counts rendered homepage H1 elements and warns when the page has none or multiple competing primary headings.',
		falsePositive:
			'Complex documentation pages can use multiple prominent headings, but a launch homepage should usually have one primary H1.'
	},
	'heading-order': {
		id: 'heading-order',
		why: 'Sequential headings create a readable document outline for search crawlers, AI extraction, and screen reader navigation.',
		detectedBy:
			'Parses rendered heading tags and warns when levels skip, such as moving from H1 directly to H3.',
		falsePositive:
			'Visually styled headings can use non-heading elements; semantic heading levels should still describe the content hierarchy.'
	},
	'health-endpoint': {
		id: 'health-endpoint',
		why: 'Apps with payments, auth, backend data, or AI calls need a simple uptime signal so deploys and monitors can tell broken from healthy.',
		detectedBy:
			'For SaaS-like apps, probes common readiness paths such as /health, /healthz, /api/health, and /status.',
		falsePositive:
			'Some static marketing sites do not need a health endpoint; Deploylint only asks for one when app/service signals are detected.'
	},
	hreflang: {
		id: 'hreflang',
		why: 'hreflang annotations help search engines serve the right localized page and avoid treating regional variants as duplicate content.',
		detectedBy:
			'Reads alternate link tags with hreflang values and validates language codes plus x-default coverage when multiple locales exist.',
		falsePositive:
			'Single-language sites do not need hreflang; the check appears only when hreflang tags are present.'
	},
	'hsts-header': {
		id: 'hsts-header',
		why: 'HSTS tells browsers to keep using HTTPS after the first secure visit, reducing downgrade and cookie-stripping risk.',
		detectedBy: 'Checks the Strict-Transport-Security header on HTTPS responses.',
		falsePositive:
			'Only enable includeSubDomains after every subdomain is HTTPS-ready; a missing HSTS header is still worth fixing for production apps.'
	},
	https: {
		id: 'https',
		why: 'HTTPS is table stakes for launches: browsers, auth cookies, payments, forms, and search trust all assume transport encryption.',
		detectedBy: 'Checks whether the final scanned URL is served over https:// after redirects.',
		falsePositive:
			'Local development and private preview tunnels may use HTTP, but public launch URLs should not.'
	},
	'json-ld': {
		id: 'json-ld',
		why: 'Structured data gives search engines and AI tools explicit facts about the product, organization, page type, and rich-result eligibility.',
		detectedBy:
			'Looks for JSON-LD script blocks in the rendered homepage, such as WebSite, Product, Organization, or FAQ schema.',
		falsePositive:
			'Not every page needs structured data, but product and landing pages usually benefit from at least WebSite or Product schema.'
	},
	lang: {
		id: 'lang',
		why: 'The html lang attribute helps browsers, assistive technology, translation tools, and crawlers interpret the page language correctly.',
		detectedBy: 'Checks the rendered html element for a non-empty lang attribute.',
		falsePositive:
			'Language can sometimes be inferred, but explicit language metadata is low-cost and improves accessibility and indexing.'
	},
	'lemon-squeezy': {
		id: 'lemon-squeezy',
		why: 'Lemon Squeezy can handle checkout quickly, but launch readiness depends on webhook fulfillment, license delivery, and subscription state changes.',
		detectedBy:
			'Looks for Lemon Squeezy script, asset, or domain signatures in rendered homepage or crawled pricing page HTML.',
		falsePositive:
			'Checkout links can be present before the product is live; verify the actual variant, fulfillment, and webhook flow in the dashboard.'
	},
	'llms-txt': {
		id: 'llms-txt',
		why: 'llms.txt can give AI assistants a concise, canonical map of what the product is, where docs live, and which pages matter most.',
		detectedBy:
			'Probes the site root for /llms.txt and checks whether the file responds with usable content.',
		falsePositive:
			'This is still an emerging convention, but it is a simple discoverability upgrade for developer-facing products.'
	},
	'meta-keywords': {
		id: 'meta-keywords',
		why: 'Meta keywords are obsolete for modern search and can leak keyword strategy without improving ranking or discoverability.',
		detectedBy: 'Scans rendered HTML for a meta keywords tag on the homepage.',
		falsePositive:
			'Legacy CMS templates may emit it automatically; removing it is usually cleaner than maintaining it.'
	},
	'mime-sniff-header': {
		id: 'mime-sniff-header',
		why: 'MIME sniffing protection helps browsers avoid treating files as executable content when the server sends an unexpected content type.',
		detectedBy: 'Checks for X-Content-Type-Options: nosniff on HTTPS responses.',
		falsePositive:
			'Some legacy asset pipelines omit this header; add it at the edge or framework middleware rather than per route.'
	},
	noindex: {
		id: 'noindex',
		why: 'A noindex homepage can make a launched product invisible to search engines even when the rest of the launch looks ready.',
		detectedBy: 'Checks rendered homepage HTML for a robots meta tag containing noindex.',
		falsePositive:
			'Staging or private preview URLs should often be noindex; the public production URL should not.'
	},
	'og-image-live': {
		id: 'og-image-live',
		why: 'Broken Open Graph images make product links look unfinished in chat apps, social feeds, and launch communities.',
		detectedBy:
			'Fetches the declared og:image URL and records whether the asset responds successfully.',
		falsePositive:
			'Some platforms generate images at request time; make sure bots and anonymous requests can still fetch the final image.'
	},
	'og-image-type': {
		id: 'og-image-type',
		why: 'Share preview images must return an actual image content type or link unfurlers may display a blank or broken card.',
		detectedBy:
			'Checks the fetched og:image response content type and warns when it looks like HTML or another non-image fallback.',
		falsePositive:
			'Edge image services can vary headers, but social preview bots need a stable image response.'
	},
	'og-site-name': {
		id: 'og-site-name',
		why: 'og:site_name gives link previews and AI summaries a clean product attribution instead of falling back to a raw domain.',
		detectedBy: 'When Open Graph tags are present, checks whether og:site_name is also declared.',
		falsePositive:
			'Some single-page brands rely on og:title alone, but site_name is useful when pages are shared out of context.'
	},
	'og-url-match': {
		id: 'og-url-match',
		why: 'A mismatched og:url can send shares, previews, and crawler attribution to the wrong canonical page.',
		detectedBy:
			'Reads og:url from rendered HTML and compares its origin and path with the final scanned page URL.',
		falsePositive:
			'Campaign pages may intentionally canonicalize shares to a main landing page; the destination should be deliberate.'
	},
	'open-graph': {
		id: 'open-graph',
		why: 'Open Graph tags control how the product appears when shared in Slack, Discord, LinkedIn, X, and many AI/browser previews.',
		detectedBy:
			'Checks for the core og:title, og:description, and og:image tags in rendered homepage HTML.',
		falsePositive:
			'Some private dashboards do not need rich previews; public marketing pages almost always do.'
	},
	paddle: {
		id: 'paddle',
		why: 'Paddle can be merchant-of-record infrastructure, but real payments still need product setup, tax settings, webhook validation, and fulfillment tests.',
		detectedBy:
			'Looks for Paddle checkout script, billing, or domain signatures in rendered homepage or crawled pricing page HTML.',
		falsePositive:
			'A docs link to Paddle can trigger detection if it includes Paddle checkout-like script names; verify the page actually loads checkout code.'
	},
	'permissions-policy-header': {
		id: 'permissions-policy-header',
		why: 'Permissions-Policy narrows browser capabilities such as camera, microphone, geolocation, and payment APIs before any injected code can ask for them.',
		detectedBy: 'Checks whether the HTTPS response includes a Permissions-Policy header.',
		falsePositive:
			'Apps that intentionally use device features should explicitly allow only the needed features and trusted origins.'
	},
	privacy: {
		id: 'privacy',
		why: 'A missing privacy policy is a trust and compliance blocker when collecting emails, analytics data, payments, or user accounts.',
		detectedBy:
			'Extracts same-page links and crawled legal pages looking for privacy-policy style destinations and usable content.',
		falsePositive:
			'Some apps host legal pages on a separate domain; link it clearly in the footer so users and scanners can find it.'
	},
	reachable: {
		id: 'reachable',
		why: 'A launch URL must return a usable page. If the homepage errors, every downstream SEO, trust, and conversion signal is unreliable.',
		detectedBy:
			'Fetches the submitted URL, follows redirects, and records the final HTTP status and URL.',
		falsePositive:
			'Scanner-blocking WAF rules can cause this even when browsers work; allow Deploylint or scan a staging URL you control.'
	},
	'referrer-header': {
		id: 'referrer-header',
		why: 'Referrer-Policy prevents sensitive paths, query strings, and campaign data from leaking to third-party sites through the Referer header.',
		detectedBy: 'Checks whether the HTTPS response includes a Referrer-Policy header.',
		falsePositive:
			'Analytics-heavy sites may choose a less strict policy, but the choice should be deliberate and documented.'
	},
	'robots-block': {
		id: 'robots-block',
		why: 'A robots.txt file that blocks all crawlers can hide a public launch from Google, Bing, AI crawlers, and link preview systems.',
		detectedBy:
			'Fetches robots.txt and checks for broad Disallow rules that block public crawling.',
		falsePositive:
			'Private staging hosts should block crawlers; production marketing pages usually should not.'
	},
	secrets: {
		id: 'secrets',
		why: 'Secrets in HTML, JavaScript, or source maps are already public. They can be copied, abused, indexed, and replayed after launch.',
		detectedBy:
			'Scans homepage HTML, crawled page HTML, sampled JavaScript, and source-map content for common secret/token patterns.',
		falsePositive:
			'Placeholder values can look secret-like; replace them with obvious examples such as YOUR_API_KEY in documentation snippets.'
	},
	'semantic-html': {
		id: 'semantic-html',
		why: 'Semantic HTML gives crawlers, AI extractors, and assistive technology real structure instead of a wall of anonymous divs.',
		detectedBy:
			'Counts semantic landmarks, sections, headings, and div-heavy markup patterns in rendered page HTML.',
		falsePositive:
			'Small pages with very little markup may not need many landmarks, but larger pages should expose meaningful structure.'
	},
	sitemap: {
		id: 'sitemap',
		why: 'A sitemap helps crawlers discover important pages quickly and exposes broken published URLs before they waste crawl budget.',
		detectedBy: 'Fetches /sitemap.xml and, when available, samples listed URLs for reachability.',
		falsePositive:
			'Very small one-page sites can be discovered without a sitemap, but it is still a low-effort launch polish item.'
	},
	'text-ratio': {
		id: 'text-ratio',
		why: 'Pages with almost no readable text in the HTML are harder for search engines and AI crawlers to understand before client JavaScript runs.',
		detectedBy:
			'Compares visible text extracted from rendered HTML against total HTML bytes when the page is large enough to evaluate.',
		falsePositive:
			'Highly interactive apps may intentionally render little public content, but marketing pages should server-render the core pitch.'
	},
	title: {
		id: 'title',
		why: 'The page title is the strongest basic search snippet signal and often the first text users see in tabs, results, and shared links.',
		detectedBy:
			'Reads the resolved title from rendered homepage HTML and checks that it exists with a useful length.',
		falsePositive:
			'Single-purpose tools can use short titles, but missing or generic titles make the site look unfinished.'
	},
	'title-brand-dupe': {
		id: 'title-brand-dupe',
		why: 'Repeating the same brand phrase around separators wastes limited title space and weakens the search-result pitch.',
		detectedBy:
			'Splits the page title on common separators and warns when every segment repeats the same text.',
		falsePositive:
			'Some brand systems intentionally repeat names, but search titles should usually spend characters on the product category or benefit.'
	},
	'twitter-card': {
		id: 'twitter-card',
		why: 'X/Twitter card tags improve link previews on X and other consumers that still read twitter:* metadata.',
		detectedBy:
			'Checks for twitter:card and verifies summary_large_image pages have a usable twitter:image or og:image.',
		falsePositive:
			'Open Graph often covers many platforms, but adding twitter:card removes ambiguity for X previews.'
	},
	viewport: {
		id: 'viewport',
		why: 'A mobile viewport tag prevents desktop-width layouts on phones and is a basic requirement for a launch page that works on mobile.',
		detectedBy: 'Checks rendered homepage HTML for a viewport meta tag.',
		falsePositive:
			'Non-visual API endpoints do not need a viewport; public websites and app shells do.'
	},
	'web-manifest': {
		id: 'web-manifest',
		why: 'A web app manifest is a small polish signal for mobile installability, app icons, theme color, and a product that feels finished.',
		detectedBy: 'Checks for a <link rel="manifest"> tag in the rendered homepage HTML.',
		falsePositive:
			'Pure documentation or API-only sites may not need installability, but most app launches benefit from the polish.'
	}
} satisfies Record<string, CheckCatalogEntry>;

export function getCheckCatalogEntry(id: string): CheckCatalogEntry | null {
	return CHECK_CATALOG[id as keyof typeof CHECK_CATALOG] ?? null;
}

export function catalogEntries(): CheckCatalogEntry[] {
	return Object.values(CHECK_CATALOG).sort((a, b) => a.id.localeCompare(b.id));
}
