export interface CheckCatalogEntry {
	id: string;
	why: string;
	detectedBy: string;
	falsePositive?: string;
}

const BASE_CHECK_CATALOG = {
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
			'Checks for valid X-Frame-Options values or a non-wildcard Content-Security-Policy frame-ancestors directive on HTTPS responses.',
		falsePositive:
			'Embedding may be intentional for widgets or dashboards; frame-ancestors should explicitly allow only trusted parent origins.'
	},
	'csp-header': {
		id: 'csp-header',
		why: 'A Content Security Policy reduces the blast radius of XSS by limiting which scripts, frames, images, and network targets the page can use.',
		detectedBy:
			'Checks whether the HTTPS response includes a Content-Security-Policy with a script/default source boundary and without broad unsafe script allowances.',
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
	'email-auth': {
		id: 'email-auth',
		why: 'SPF and DMARC records are basic deliverability and anti-spoofing controls for transactional, onboarding, and support email.',
		detectedBy:
			'When DNS TXT resolution is available, checks the scanned domain and _dmarc subdomain for SPF and DMARC records.',
		falsePositive:
			'The web domain may not be the same as the sending domain; scan or document the actual mail-from domain when it differs.'
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
	'exposed-backup': {
		id: 'exposed-backup',
		why: 'Public backup archives and .env snapshots often contain source, credentials, database dumps, or configuration that was never meant for the web root.',
		detectedBy:
			'Probes common same-origin backup paths such as /backup.zip and /.env.bak and checks whether they return reachable content.',
		falsePositive:
			'A deliberate decoy can still attract automated exploit traffic; block backup filenames at the edge rather than serving them.'
	},
	'exposed-env': {
		id: 'exposed-env',
		why: 'A public dotenv file usually means live credentials are downloadable by anyone. Treat every value in it as compromised.',
		detectedBy:
			'Probes common same-origin dotenv paths such as /.env and checks whether they return reachable secret-like content.',
		falsePositive:
			'A honeypot or empty placeholder file can still be confusing to automated reviewers and attackers; remove it from the public web root.'
	},
	'exposed-git': {
		id: 'exposed-git',
		why: 'An exposed .git directory can reveal source code, commit history, and secrets that were removed from the current working tree.',
		detectedBy: 'Probes same-origin /.git/HEAD and related metadata paths for public reachability.',
		falsePositive:
			'Rarely intentional. If this is a static decoy, block it anyway so automated exploit tooling does not treat the host as vulnerable.'
	},
	'exposed-package': {
		id: 'exposed-package',
		why: 'A publicly served package.json exposes dependency names, scripts, and framework choices that make automated targeting easier.',
		detectedBy:
			'Probes the site root for /package.json and warns when it is reachable from the public origin.',
		falsePositive:
			'Open-source apps already publish this information, but static hosts should normally serve built assets rather than repository metadata.'
	},
	favicon: {
		id: 'favicon',
		why: 'A favicon is a basic product identity signal across tabs, bookmarks, search surfaces, and link previews.',
		detectedBy:
			'Checks rendered homepage metadata for a favicon link discovered by the page parser.',
		falsePositive:
			'Browsers may still request /favicon.ico implicitly, but declaring the icon avoids ambiguity for browsers and preview systems.'
	},
	fetch: {
		id: 'fetch',
		why: 'If Deploylint cannot fetch the target, it cannot judge SEO, legal, social preview, security headers, or app readiness with confidence.',
		detectedBy:
			'Runs the initial public fetch for the submitted deploy target and records network failures or blocked automated fetches.',
		falsePositive:
			'Bot-protected enterprise sites may block automated reviewers intentionally. For your own launch, test a staging target that allows automated fetches.'
	},
	firebase: {
		id: 'firebase',
		why: 'Firebase-backed launches need explicit security rules, environment separation, and production project review before user data is trusted.',
		detectedBy:
			'Looks for Firebase package, script, config, or hosting signatures in rendered homepage or crawled page HTML.',
		falsePositive:
			'Docs, blog posts, or integrations pages can mention Firebase without the production app using it client-side.'
	},
	'font-loading': {
		id: 'font-loading',
		why: 'Poor font loading can hide text during first paint and make a launch page feel broken on slower networks.',
		detectedBy:
			'Checks @font-face blocks and Google Fonts stylesheet URLs for font-display or display=swap style loading hints.',
		falsePositive:
			'Self-hosted fonts can be optimized by other means, but visible text should not be blocked while fonts download.'
	},
	'form-labels': {
		id: 'form-labels',
		why: 'Inputs without labels break screen-reader navigation and make signup, contact, and checkout forms harder to complete.',
		detectedBy:
			'Scans rendered form controls for associated label elements, aria-label, aria-labelledby, or title fallbacks.',
		falsePositive:
			'Some design systems label fields through custom components after hydration; verify the accessible name in browser accessibility tooling.'
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
	'host-consistency': {
		id: 'host-consistency',
		why: 'Apex and www inconsistencies split SEO signals, confuse users, and create broken preview or redirect paths.',
		detectedBy:
			'Fetches the sibling apex/www host when applicable and compares whether it reaches the same site or redirects consistently.',
		falsePositive:
			'Some products deliberately use www and apex for different surfaces; the canonical choice should be explicit and documented.'
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
		detectedBy:
			'Checks the Strict-Transport-Security header on HTTPS responses and requires a meaningful max-age instead of a disabled or token header.',
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
	'img-alt': {
		id: 'img-alt',
		why: 'Missing image alt text weakens accessibility and can hide important product context from assistive technology and crawlers.',
		detectedBy:
			'Uses parsed page metadata to count sampled image elements without alt text in the rendered homepage.',
		falsePositive:
			'Decorative images should use alt="", which may still require a manual review if the image parser cannot see author intent.'
	},
	'img-dimensions': {
		id: 'img-dimensions',
		why: 'Images without reserved dimensions can cause layout shift as they load, harming Core Web Vitals and perceived polish.',
		detectedBy:
			'Counts image tags and checks for width and height attributes or inline width and height styles once enough images exist.',
		falsePositive:
			'CSS aspect-ratio or framework image components may reserve space in ways this static HTML check cannot fully infer.'
	},
	'img-lazy': {
		id: 'img-lazy',
		why: 'Below-the-fold images that load eagerly compete with critical content and can slow first paint and LCP.',
		detectedBy:
			'Counts image tags and checks whether at least one page image uses loading="lazy" once the image count is high enough.',
		falsePositive:
			'Hero and above-the-fold images should not be lazy-loaded; this check only signals a page-wide absence of lazy loading on image-heavy pages.'
	},
	'inline-data-bloat': {
		id: 'inline-data-bloat',
		why: 'Large serialized JSON in HTML inflates every page load and delays parsing before visitors can interact with the launch page.',
		detectedBy:
			'Measures inline script blocks that look like JSON state, framework hydration data, or JSON.parse payloads.',
		falsePositive:
			'Some app shells intentionally inline critical state to avoid another request; the payload should still be bounded and justified.'
	},
	'json-ld': {
		id: 'json-ld',
		why: 'Structured data gives search engines and AI tools explicit facts about the product, organization, page type, and rich-result eligibility.',
		detectedBy:
			'Looks for JSON-LD script blocks in the rendered homepage, such as WebSite, Product, Organization, or FAQ schema.',
		falsePositive:
			'Not every page needs structured data, but product and landing pages usually benefit from at least WebSite or Product schema.'
	},
	landmarks: {
		id: 'landmarks',
		why: 'Page landmarks let keyboard and screen-reader users jump directly to navigation, main content, and footer regions.',
		detectedBy:
			'Scans rendered HTML for landmark elements such as main, nav, header, footer, aside, and ARIA landmark roles.',
		falsePositive:
			'Very small single-purpose pages may still be usable without many landmarks, but public app shells should expose a main region.'
	},
	lang: {
		id: 'lang',
		why: 'The html lang attribute helps browsers, assistive technology, translation tools, and crawlers interpret the page language correctly.',
		detectedBy: 'Checks the rendered html element for a non-empty lang attribute.',
		falsePositive:
			'Language can sometimes be inferred, but explicit language metadata is low-cost and improves accessibility and indexing.'
	},
	'last-updated-staleness': {
		id: 'last-updated-staleness',
		why: 'Visible stale update dates make a product look neglected and can reduce trust in docs, pricing, and launch claims.',
		detectedBy:
			'Finds last-updated style date phrases in rendered text and warns when the newest detected date is older than the freshness threshold.',
		falsePositive:
			'Historical content can intentionally preserve old dates; the signal is most relevant to homepages, docs, and policy freshness claims.'
	},
	'lemon-squeezy': {
		id: 'lemon-squeezy',
		why: 'Lemon Squeezy can handle checkout quickly, but launch readiness depends on webhook fulfillment, license delivery, and subscription state changes.',
		detectedBy:
			'Looks for Lemon Squeezy script, asset, or domain signatures in rendered homepage or crawled pricing page HTML.',
		falsePositive:
			'Checkout links can be present before the product is live; verify the actual variant, fulfillment, and webhook flow in the dashboard.'
	},
	'license-risk': {
		id: 'license-risk',
		why: 'Copyleft, non-commercial, or unknown frontend libraries can block paid launches or require obligations the team has not planned for.',
		detectedBy:
			'Builds a license audit from detected CDN libraries and known license metadata, then emits conditions or warnings when commercial use needs review.',
		falsePositive:
			'Licenses can vary by package version or commercial agreement; treat this as a review trigger, not legal advice.'
	},
	links: {
		id: 'links',
		why: 'Broken internal links block users, waste crawler budget, and make a launch site look untested.',
		detectedBy:
			'Samples same-origin links discovered from rendered HTML and records how many sampled destinations fail reachability checks.',
		falsePositive:
			'Bot protection or rate limiting can make every sampled link fail; Deploylint downgrades that pattern and asks for manual spot checks.'
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
		detectedBy: 'Checks for an exact X-Content-Type-Options: nosniff value on HTTPS responses.',
		falsePositive:
			'Some legacy asset pipelines omit this header; add it at the edge or framework middleware rather than per route.'
	},
	'mixed-content': {
		id: 'mixed-content',
		why: 'HTTP assets on an HTTPS page can be blocked by browsers and undermine the security guarantees users expect from the lock icon.',
		detectedBy:
			'Scans rendered HTTPS page HTML for obvious http:// script, stylesheet, image, and asset URLs.',
		falsePositive:
			'Text examples and documentation snippets can include http:// without being loaded as assets; review the flagged HTML context.'
	},
	noindex: {
		id: 'noindex',
		why: 'A noindex homepage can make a launched product invisible to search engines even when the rest of the launch looks ready.',
		detectedBy: 'Checks rendered homepage HTML for a robots meta tag containing noindex.',
		falsePositive:
			'Staging or private preview URLs should often be noindex; the public production URL should not.'
	},
	noopener: {
		id: 'noopener',
		why: 'External links opened in new tabs should not give the destination page access back to the opener window.',
		detectedBy:
			'Scans external target="_blank" links and checks whether rel includes noopener or noreferrer, warning when unsafe links exceed the threshold.',
		falsePositive:
			'Modern browsers mitigate many opener risks, but explicit rel attributes remain cheap defense and improve lint consistency.'
	},
	'not-found-page': {
		id: 'not-found-page',
		why: 'Soft 404s make broken URLs look successful to crawlers and hide routing mistakes from monitoring and deploy checks.',
		detectedBy:
			'Requests randomized missing paths and checks whether the host returns a real 404/410 instead of a 200 homepage fallback.',
		falsePositive:
			'Some SPAs intentionally serve index.html for client routing; public hosts should still return 404 for unknown content URLs when possible.'
	},
	'og-image-live': {
		id: 'og-image-live',
		why: 'Broken Open Graph images make product links look unfinished in chat apps, social feeds, and launch communities.',
		detectedBy:
			'Probes the declared og:image URL with HEAD and falls back to a bounded GET when HEAD is rejected, then records whether the asset responds successfully.',
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
	'page-weight': {
		id: 'page-weight',
		why: 'Heavy HTML and excessive scripts slow first visits, especially from search and social links where users have low patience.',
		detectedBy:
			'Uses parsed metadata for HTML byte size, total scripts, and blocking scripts in the head against launch-oriented thresholds.',
		falsePositive:
			'Some authenticated app shells are intentionally script-heavy; public marketing pages should still keep first-load weight under control.'
	},
	'permissions-policy-header': {
		id: 'permissions-policy-header',
		why: 'Permissions-Policy narrows browser capabilities such as camera, microphone, geolocation, and payment APIs before any injected code can ask for them.',
		detectedBy:
			'Checks whether the HTTPS response includes a Permissions-Policy that explicitly denies camera, microphone, and geolocation by default.',
		falsePositive:
			'Apps that intentionally use device features should explicitly allow only the needed features and trusted origins.'
	},
	'placeholder-copy': {
		id: 'placeholder-copy',
		why: 'Template copy, TODO text, and lorem ipsum are high-signal launch failures that users and reviewers notice immediately.',
		detectedBy:
			'Scans the homepage and crawled internal pages for known placeholder phrases, example domains, TODO markers, and coming-soon copy.',
		falsePositive:
			'Documentation can intentionally mention example.com or TODO; public product copy should avoid leaving those strings in user-facing sections.'
	},
	'positive-tabindex': {
		id: 'positive-tabindex',
		why: 'Positive tabindex values override natural keyboard order and make forms and navigation unpredictable for keyboard users.',
		detectedBy: 'Scans rendered HTML for tabindex values greater than zero.',
		falsePositive:
			'Specialized widgets can manage focus deliberately, but positive tabindex on launch pages is usually a maintainability and accessibility smell.'
	},
	preconnect: {
		id: 'preconnect',
		why: 'Third-party origins for fonts, CDNs, and analytics add DNS and TLS latency unless the browser can connect early.',
		detectedBy:
			'Counts third-party src and href origins and checks for preconnect or dns-prefetch link hints in the document.',
		falsePositive:
			'The browser may learn origins from HTTP/2 push, early hints, or bundler output not visible in static HTML.'
	},
	'pricing-path': {
		id: 'pricing-path',
		why: 'A clear pricing path answers the buyer question "what does it cost" and improves search coverage for commercial intent.',
		detectedBy:
			'Looks for pricing links, pricing sections, plan language, or pricing routes across rendered homepage and crawled pages.',
		falsePositive:
			'Invite-only, sales-led, or free beta products may intentionally avoid public pricing, but the page should say that clearly.'
	},
	'pricing-clarity': {
		id: 'pricing-clarity',
		why: 'Contact-sales-only pricing can block self-serve buyers who need a budget answer before booking a call or trying the product.',
		detectedBy:
			'Scans visible commercial copy for contact-sales or custom-pricing language and checks whether a concrete price, free plan, or entry price is also present.',
		falsePositive:
			'Enterprise-only products can intentionally hide public pricing, but the page should explain the buying model and expected sales path.'
	},
	'primary-cta': {
		id: 'primary-cta',
		why: 'A launch page needs one obvious next step so visitors from search, social, and AI referrals know how to act.',
		detectedBy:
			'Scans rendered links and buttons for action-oriented CTA language and enough prominence in the page text.',
		falsePositive:
			'Documentation-first sites may optimize for reading instead of signup, but they still need a clear primary user path.'
	},
	privacy: {
		id: 'privacy',
		why: 'A missing privacy policy is a trust and compliance blocker when collecting emails, analytics data, payments, or user accounts.',
		detectedBy:
			'Extracts same-page links and crawled legal pages looking for privacy-policy style destinations and usable content.',
		falsePositive:
			'Some apps host legal pages on a separate domain; link it clearly in the footer so users and automated reviewers can find it.'
	},
	reachable: {
		id: 'reachable',
		why: 'A launch URL must return a usable page. If the homepage errors, every downstream SEO, trust, and conversion signal is unreliable.',
		detectedBy:
			'Fetches the submitted deploy target, follows redirects, and records the final HTTP status and URL.',
		falsePositive:
			'Automation-blocking WAF rules can cause this even when browsers work; allow Deploylint or review a staging target you control.'
	},
	'referrer-header': {
		id: 'referrer-header',
		why: 'Referrer-Policy prevents sensitive paths, query strings, and campaign data from leaking to third-party sites through the Referer header.',
		detectedBy:
			'Checks whether the HTTPS response includes a strict Referrer-Policy such as no-referrer, same-origin, strict-origin, or strict-origin-when-cross-origin.',
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

const ADDITIONAL_CHECK_CATALOG = {
	'accessible-names': {
		id: 'accessible-names',
		why: 'Icon-only controls without names block screen-reader users from understanding critical navigation, signup, and app actions.',
		detectedBy:
			'Scans buttons, role=button elements, and links for visible text, aria labels, labelledby references, or useful linked image alt text.',
		falsePositive:
			'Client-side components can add names after hydration; verify questionable cases with browser accessibility tooling or a screen reader.'
	},
	analytics: {
		id: 'analytics',
		why: 'Launch teams need measurement to know whether search, referrals, AI answers, and campaigns are actually bringing useful traffic.',
		detectedBy:
			'Looks for common analytics stacks in rendered HTML, including GA4, GTM, Plausible, PostHog, and Fathom.',
		falsePositive:
			'Server-side analytics, consent-delayed loading, or log-based measurement may be intentionally invisible to the static scan.'
	},
	'apple-touch-icon': {
		id: 'apple-touch-icon',
		why: 'Mobile home-screen saves and iOS previews look unfinished when the browser falls back to screenshots instead of a product icon.',
		detectedBy: 'Checks rendered homepage metadata for an apple-touch-icon link declaration.',
		falsePositive:
			'Manifest icons can cover some platforms, but Safari still benefits from a direct apple-touch-icon declaration.'
	},
	'billing-portal': {
		id: 'billing-portal',
		why: 'Paid products need a customer billing path so users can manage payment methods, invoices, and subscriptions without support tickets.',
		detectedBy:
			'Scans public repository files for Stripe-like billing portal calls, customer portal references, or billing-management routes.',
		falsePositive:
			'Billing management may live in a private service or provider-hosted dashboard not visible in the scanned repository.'
	},
	'checkout-server-owned': {
		id: 'checkout-server-owned',
		why: 'Checkout creation must stay behind a server boundary so prices, customer identity, coupons, and payment intent parameters cannot be changed from the browser.',
		detectedBy:
			'Scans repository payment code for server-side checkout session or payment intent creation and flags client-only Stripe checkout initialization.',
		falsePositive:
			'Checkout may be owned by another backend service, but the scanned app should not imply that the browser creates or controls paid checkout directly.'
	},
	'subscription-checkout-mode': {
		id: 'subscription-checkout-mode',
		why: 'Subscription SaaS checkout must create recurring subscriptions, not one-time payment sessions that leave access, renewal, and cancellation state out of sync.',
		detectedBy:
			'Scans Stripe Checkout session creation alongside subscription lifecycle signals and checks for an explicit subscription mode.',
		falsePositive:
			'Usage-based or one-time-credit products may intentionally use payment mode; document that model and keep subscription webhook code out of the checkout path.'
	},
	'blocking-css': {
		id: 'blocking-css',
		why: 'Too many render-blocking stylesheets delay first paint and make a launch page feel slow before users can evaluate it.',
		detectedBy:
			'Counts active stylesheet links in the document head while ignoring print media and disabled stylesheets.',
		falsePositive:
			'Framework preload behavior, HTTP early hints, or critical CSS strategies can reduce the runtime impact beyond what static HTML shows.'
	},
	'broken-anchor-nav': {
		id: 'broken-anchor-nav',
		why: 'In-page navigation that points nowhere makes pricing, FAQ, and CTA links feel broken and damages trust immediately.',
		detectedBy:
			'Compares same-page hash links against rendered id and name targets and flags repeated href placeholder stubs.',
		falsePositive:
			'Client-side code may create targets after hydration, but landing navigation should still have stable HTML anchors.'
	},
	'ci-config': {
		id: 'ci-config',
		why: 'A repository without CI relies on manual discipline for every deploy, which is risky when code changes quickly or AI edits are accepted.',
		detectedBy: 'Checks the GitHub repository tree for workflow files under .github/workflows.',
		falsePositive:
			'Some teams use external CI systems not visible in GitHub; document that system if GitHub Actions is intentionally absent.'
	},
	'ci-runs-quality-gates': {
		id: 'ci-runs-quality-gates',
		why: 'CI should run the same lint, typecheck, test, and build gates developers trust before code reaches production.',
		detectedBy:
			'Parses GitHub Actions run commands for recognizable lint, check/typecheck, test, and build commands.',
		falsePositive:
			'Monorepo wrappers such as turbo or custom verify scripts can hide the underlying gates from regex-based workflow analysis.'
	},
	'deploylint-ci-wiring': {
		id: 'deploylint-ci-wiring',
		why: 'Deploy readiness evidence is most valuable when it appears directly on pull requests before risky changes merge.',
		detectedBy:
			'Scans GitHub Actions workflow text for Deploylint URL/mode environment variables, the hosted gate script, or the Deploylint composite action.',
		falsePositive:
			'Teams may enforce Deploylint through another CI system or a reusable workflow outside the sampled repository; link or mirror that workflow if so.'
	},
	contact: {
		id: 'contact',
		why: 'A public launch needs an obvious support or contact path so users, buyers, and security reporters are not left guessing.',
		detectedBy:
			'Extracts same-origin links and checks whether contact, support, help, or similar destinations are linked.',
		falsePositive:
			'Support may be handled inside an authenticated app or external helpdesk; link that route clearly from the public site.'
	},
	'support-path': {
		id: 'support-path',
		why: 'Buyers and early users check how to get help before committing money or data, and placeholder support links damage trust quickly.',
		detectedBy:
			'Finds support, help, contact-support, and customer-service anchors and warns when their hrefs are empty, hash-only, javascript-only, or obvious placeholders.',
		falsePositive:
			'Support can live inside an authenticated product or external helpdesk, but public marketing pages should still expose a working route or mailbox.'
	},
	'cookie-consent': {
		id: 'cookie-consent',
		why: 'Cookie-based tracking without consent controls can create privacy compliance risk and undermine trust with EU and enterprise visitors.',
		detectedBy:
			'Detects cookie-based analytics stacks and checks for common consent-management scripts in rendered HTML.',
		falsePositive:
			'Consent may be enforced through tag-manager rules or server rendering that is not visible from the initial HTML.'
	},
	'copyright-year': {
		id: 'copyright-year',
		why: 'A stale copyright year is a simple visible signal that a launch site may be abandoned or poorly maintained.',
		detectedBy:
			'Finds footer-style copyright text and compares the newest detected year with the current calendar year.',
		falsePositive:
			'Historical articles or legal notices can intentionally show older dates; the signal targets product chrome and footer branding.'
	},
	'cta-competition': {
		id: 'cta-competition',
		why: 'Too many competing calls to action split visitor attention and make the primary conversion path less obvious.',
		detectedBy:
			'Counts distinct action-oriented link and button labels after normalizing repeated CTA text.',
		falsePositive:
			'Complex apps can legitimately expose several task actions; launch homepages usually need one dominant next step.'
	},
	'cta-availability': {
		id: 'cta-availability',
		why: 'A visible CTA that is disabled, empty, or only points to a stub wastes high-intent traffic and makes the product feel unfinished.',
		detectedBy:
			'Parses rendered button and anchor CTAs, then flags pages where every detected action is disabled, aria-disabled, blank, hash-only, or javascript-only.',
		falsePositive:
			'Some gated launches intentionally disable signup until approval, but the public page should route buyers to a working waitlist or contact path.'
	},
	'dead-social-links': {
		id: 'dead-social-links',
		why: 'Template social links and placeholder handles make a product look unfinished and lower visitor trust.',
		detectedBy:
			'Scans common social links for root domains, placeholder handles, href stubs, and obvious template destinations.',
		falsePositive:
			'Some brands intentionally link to company-level social roots, but most public launch pages should use concrete profile URLs.'
	},
	'debug-in-bundle': {
		id: 'debug-in-bundle',
		why: 'Console noise, debugger statements, and test markers in production bundles signal weak release hygiene and can leak implementation clues.',
		detectedBy:
			'Samples same-origin JavaScript and counts console.log, debugger, and data-testid markers above launch thresholds.',
		falsePositive:
			'Some teams intentionally keep harmless logs or test IDs in production; treat this as a hygiene signal, not proof of exploitability.'
	},
	'default-favicon-title': {
		id: 'default-favicon-title',
		why: 'Default framework titles and favicons are obvious starter-template leftovers that reviewers and users notice quickly.',
		detectedBy:
			'Checks resolved title and favicon URLs for known template values such as Vite App and vite.svg.',
		falsePositive:
			'A real product name can overlap with a framework word, so the detector focuses on exact template-style leftovers.'
	},
	'dependabot-config': {
		id: 'dependabot-config',
		why: 'Dependency update automation keeps routine security and compatibility patches visible before stale packages become incidents.',
		detectedBy:
			'Checks repository files for Dependabot or Renovate configuration in common root and GitHub config paths.',
		falsePositive:
			'Teams may manage updates through another bot or private process; document that process if no standard config is present.'
	},
	'codeql-code-scanning': {
		id: 'codeql-code-scanning',
		why: 'CodeQL code scanning catches source and workflow security issues during review before they become production or supply-chain incidents.',
		detectedBy: 'Scans GitHub Actions workflow uses references for github/codeql-action steps.',
		falsePositive:
			'GitHub default setup can enable CodeQL without a committed workflow file; document that dashboard setting if it is the intended control.'
	},
	'dependency-review-action': {
		id: 'dependency-review-action',
		why: 'Dependency review catches vulnerable or risky dependency changes during pull-request review instead of after deployment.',
		detectedBy:
			'Scans GitHub Actions workflow uses references for actions/dependency-review-action.',
		falsePositive:
			'Other supply-chain scanners can cover the same control, but they are not visible unless configured in the repository.'
	},
	'deploy-config': {
		id: 'deploy-config',
		why: 'Code-owned deploy configuration makes runtime behavior reviewable, reproducible, and less dependent on dashboard-only settings.',
		detectedBy:
			'Looks for common deployment files such as wrangler config, vercel.json, netlify.toml, Dockerfile, or docker-compose.',
		falsePositive:
			'Simple hosts can be intentionally dashboard-managed; this is acceptable when documented and backed by CI deploy checks.'
	},
	'dkim-dns': {
		id: 'dkim-dns',
		why: 'DKIM signing improves inbox placement and helps prove product, billing, and support emails really came from the domain.',
		detectedBy:
			'When DNS TXT resolution is available, probes common DKIM selector records for the scanned domain and apex fallback.',
		falsePositive:
			'Providers can use custom selectors outside the common probe list; verify directly in the email provider dashboard.'
	},
	'docker-env-copy': {
		id: 'docker-env-copy',
		why: 'Copying dotenv files into container images bakes secrets into artifacts that can be pulled, cached, or leaked later.',
		detectedBy:
			'Scans Dockerfile text for direct COPY or ADD instructions that copy .env into the image.',
		falsePositive:
			'Multi-stage Dockerfiles and broad COPY patterns need manual review; this check catches the explicit high-risk case.'
	},
	'entitlement-fulfillment': {
		id: 'entitlement-fulfillment',
		why: 'Taking payment without a reliable grant and revoke path creates paid users who cannot access the product or unpaid users who keep access after cancellation.',
		detectedBy:
			'Scans payment lifecycle handling for fulfillment, entitlement, access grant, access revoke, or subscription state update signals.',
		falsePositive:
			'Access may be fulfilled in another worker or queue, but the repository should leave a clear payment-to-entitlement handoff for launch review.'
	},
	'format-script': {
		id: 'format-script',
		why: 'A reliable format command reduces noisy diffs and makes automated or agent-generated changes easier to review.',
		detectedBy:
			'Compares formatter config files and package scripts for Prettier or Biome format commands.',
		falsePositive:
			'Some projects enforce formatting through an editor, pre-commit hook, or CI wrapper not obvious from root package scripts.'
	},
	'gitignore-env': {
		id: 'gitignore-env',
		why: 'Ignoring dotenv files prevents one accidental git add from committing live credentials into repository history.',
		detectedBy: 'Checks for a .gitignore file and looks for env-file ignore patterns.',
		falsePositive:
			'Some repositories intentionally commit example env files; real .env values should still be excluded or templated safely.'
	},
	'lint-script': {
		id: 'lint-script',
		why: 'A real lint script catches maintainability, correctness, and security footguns before review or deployment.',
		detectedBy:
			'Inspects package scripts, lint dependencies, and static config files for useful ESLint or Biome invocation.',
		falsePositive:
			'Custom verify wrappers can run lint without naming the command lint; expose or document the local quality entrypoint.'
	},
	'lockfile-committed': {
		id: 'lockfile-committed',
		why: 'A committed lockfile makes installs reproducible and reduces surprise dependency changes between local, CI, and production.',
		detectedBy:
			'Scans repository files for common package-manager lockfiles such as package-lock, pnpm-lock, yarn.lock, or bun locks.',
		falsePositive:
			'Libraries sometimes avoid lockfiles intentionally, but deployed applications should usually commit exactly one lockfile family.'
	},
	'mailto-exposure': {
		id: 'mailto-exposure',
		why: 'Raw email addresses in page source are easy for spam harvesters to scrape at scale.',
		detectedBy:
			'Scans rendered HTML text outside scripts for distinct email addresses while ignoring examples and image-density false positives.',
		falsePositive:
			'A visible support email can be an intentional trust choice; the warning is about volume and scraping tradeoffs.'
	},
	'mixed-lockfiles': {
		id: 'mixed-lockfiles',
		why: 'Multiple package-manager lockfile families make installs ambiguous and increase the chance CI uses different dependencies than developers.',
		detectedBy:
			'Maps root lockfiles to npm, pnpm, Yarn, or Bun and warns when more than one manager family is present.',
		falsePositive:
			'Polyglot monorepos can contain isolated projects, but each JavaScript app should still have a clear manager boundary.'
	},
	'node-version-pinned': {
		id: 'node-version-pinned',
		why: 'Pinning Node prevents deploy and contributor failures caused by incompatible runtime versions.',
		detectedBy:
			'Looks for package.json engines.node, .nvmrc, or .node-version in the repository tree.',
		falsePositive:
			'Non-Node projects or platform-managed runtimes may not need this; Node apps should declare the expected runtime.'
	},
	'package-manager-pinned': {
		id: 'package-manager-pinned',
		why: 'Pinning the package manager keeps Corepack, contributors, and CI aligned on the same install semantics.',
		detectedBy:
			'Reads packageManager or devEngines.packageManager and compares it with committed lockfile families.',
		falsePositive:
			'Some legacy projects standardize the manager outside package.json; the repo should still make that choice visible.'
	},
	'package-scripts': {
		id: 'package-scripts',
		why: 'Root lint, test, and build scripts give contributors and deploy gates a single obvious pre-push command surface.',
		detectedBy:
			'Reads root or primary package.json scripts and rejects missing or placeholder lint, test, and build commands.',
		falsePositive:
			'Nested workspace apps can own the real scripts; root scripts should delegate to them so the quality gate is discoverable.'
	},
	'payment-env-safety': {
		id: 'payment-env-safety',
		why: 'Live payment secrets in source code can be copied from git history or bundles and used to create charges, read customers, or alter subscriptions.',
		detectedBy:
			'Scans payment-related repository files for live secret-key literals and checks whether payment secrets appear to come from environment bindings.',
		falsePositive:
			'Some sampled code may be a documentation fixture, but real payment secrets should always live in provider-managed secrets or environment bindings.'
	},
	readme: {
		id: 'readme',
		why: 'The README is the repository landing page for collaborators, buyers, and auditors evaluating whether the project is maintained.',
		detectedBy:
			'Checks for a root README and counts visible words to distinguish useful documentation from a stub.',
		falsePositive:
			'Private repositories may document elsewhere, but public or shared launch repos should include basic setup and deployment notes.'
	},
	'redirect-chain': {
		id: 'redirect-chain',
		why: 'Long redirect chains add latency, dilute canonical signals, and make first visits from search or social links feel slower.',
		detectedBy:
			'Uses recorded homepage redirect hops and warns or fails when the final URL required multiple redirects.',
		falsePositive:
			'Some migrations temporarily require redirects; keep the chain short and point canonical links directly to the final host.'
	},
	'repo-license': {
		id: 'repo-license',
		why: 'Repository license terms determine whether the code can be reused, sold, contributed to, or embedded in a commercial product.',
		detectedBy:
			'Reads GitHub repository license metadata and classifies common SPDX IDs for commercial-use risk.',
		falsePositive:
			'License interpretation can require legal review, especially for dual licenses, custom terms, or private commercial agreements.'
	},
	'response-time': {
		id: 'response-time',
		why: 'Slow first responses hurt users, crawlers, and link-preview bots before frontend optimization has a chance to matter.',
		detectedBy:
			'Records the deploy target fetch duration from the automated runner and classifies it as a single-sample launch signal.',
		falsePositive:
			'One runner region is not a full performance study; use real-user monitoring and Core Web Vitals for final performance decisions.'
	},
	robots: {
		id: 'robots',
		why: 'robots.txt helps crawlers discover crawl policy and sitemap hints, even when the site is otherwise indexable.',
		detectedBy:
			'Probes /robots.txt and records whether it responds during same-origin link checks.',
		falsePositive:
			'Very small sites can still be indexed without robots.txt, but launch sites benefit from a simple explicit policy.'
	},
	'security-txt': {
		id: 'security-txt',
		why: 'security.txt gives researchers and enterprise reviewers a clear path to report vulnerabilities responsibly.',
		detectedBy:
			'Fetches /.well-known/security.txt and /security.txt and validates that the text contains an RFC-style Contact line.',
		falsePositive:
			'Some organizations publish disclosure details elsewhere; link or mirror the contact path in security.txt for crawler discovery.'
	},
	'signup-friction': {
		id: 'signup-friction',
		why: 'Long signup forms reduce conversion and create unnecessary friction before users experience the product value.',
		detectedBy:
			'Finds email signup forms and counts required inputs or aria-required fields above a launch threshold.',
		falsePositive:
			'High-compliance products may require more fields up front; explain why and avoid asking for data that can wait.'
	},
	'skip-link': {
		id: 'skip-link',
		why: 'Skip links let keyboard users bypass long navigation and reach the main content without excessive tabbing.',
		detectedBy:
			'On nav-heavy pages, checks the early body markup for a skip-to-content style anchor.',
		falsePositive:
			'Short pages or custom app shells may have different keyboard affordances; verify focus order manually when uncertain.'
	},
	'social-proof': {
		id: 'social-proof',
		why: 'Honest social proof reduces launch skepticism by showing that real people or teams already use or trust the product.',
		detectedBy:
			'Looks for testimonial, trusted-by, usage, review, rating, or customer-story language in visible page text.',
		falsePositive:
			'Brand-new products may intentionally have no proof yet; avoid fake proof and use honest beta/user numbers instead.'
	},
	sri: {
		id: 'sri',
		why: 'Subresource Integrity reduces the blast radius if a third-party CDN script is compromised or replaced upstream.',
		detectedBy:
			'Scans third-party script tags and compares the number of external scripts with integrity attributes.',
		falsePositive:
			'Fast-changing third-party scripts can be incompatible with SRI; self-host or document the vendor risk if you cannot pin hashes.'
	},
	stripe: {
		id: 'stripe',
		why: 'Stripe checkout on a launch page means payments, webhook signing, fulfillment, and live/test key separation must be production-ready.',
		detectedBy:
			'Looks for Stripe.js, Stripe domains, or publishable-key patterns in homepage and crawled page HTML.',
		falsePositive:
			'Docs links or pricing copy can mention Stripe without an active checkout integration; verify actual script/init evidence.'
	},
	supabase: {
		id: 'supabase',
		why: 'Supabase client usage requires Row Level Security and least-privilege policies before user data is exposed.',
		detectedBy:
			'Looks for Supabase project domains or client signatures in homepage and crawled page HTML.',
		falsePositive:
			'Blog posts, docs, or integration pages can mention Supabase even when production data is served elsewhere.'
	},
	'svelte-check': {
		id: 'svelte-check',
		why: 'SvelteKit apps need svelte-check to catch template, route, and prop typing problems that plain TypeScript can miss.',
		detectedBy:
			'Detects SvelteKit dependencies and verifies svelte-check is installed and invoked by check or typecheck scripts.',
		falsePositive:
			'Some Svelte projects use custom tooling, but SvelteKit production apps should expose a dependable template typecheck.'
	},
	terms: {
		id: 'terms',
		why: 'Terms of service set user expectations for paid products, accounts, acceptable use, refunds, and liability.',
		detectedBy:
			'Extracts same-origin links and crawled legal pages looking for terms, tos, legal, or terms-of-service destinations.',
		falsePositive:
			'Some free or internal tools do not need full terms, but paid or account-based products should link clear terms.'
	},
	'legal-links': {
		id: 'legal-links',
		why: 'Commercial pages that collect emails, accounts, or payments need visible privacy and terms links before serious buyers trust the signup path.',
		detectedBy:
			'Looks for commercial signals such as pricing, plans, signup forms, checkout, and paid CTAs, then verifies privacy and terms anchors are present.',
		falsePositive:
			'Legal pages can be hosted on a parent company or help-center domain, but the public launch page should still link them clearly.'
	},
	'tests-present': {
		id: 'tests-present',
		why: 'Tests are the safety net that make refactoring, dependency updates, and AI-generated changes reviewable before launch.',
		detectedBy:
			'Looks for test files or meaningful test scripts in the repository tree and root package manifest.',
		falsePositive:
			'Manual QA or external test suites may exist outside the repository; the scanned repo should still expose its core verification path.'
	},
	'test-depth': {
		id: 'test-depth',
		why: 'A repo can look tested while still relying on one trivial smoke assertion, no coverage gate, and no integration or end-to-end evidence.',
		detectedBy:
			'Samples repository test files across common JavaScript, Python, Go, Rust, Ruby, PHP, and .NET layouts, then checks for real assertions, coverage signals, and visible test breadth.',
		falsePositive:
			'Deep tests may live in a private companion repo or external CI service; document that path or expose the verification command in the scanned repo.'
	},
	'ts-strict': {
		id: 'ts-strict',
		why: 'TypeScript strict mode catches null, undefined, and typing mistakes that otherwise become runtime defects.',
		detectedBy: 'Parses tsconfig.json and checks whether compilerOptions.strict is enabled.',
		falsePositive:
			'Migrating legacy code can require incremental strictness; document the plan and enable strict for new code where possible.'
	},
	'typecheck-script': {
		id: 'typecheck-script',
		why: 'A typecheck script gives CI and contributors a fast way to catch compile-time defects without running a full build.',
		detectedBy:
			'Checks package scripts for check or typecheck commands and validates TypeScript/SvelteKit setup when detected.',
		falsePositive:
			'Some builds run typechecking internally, but an explicit command is easier to run and gate in CI.'
	},
	'webhook-signature-missing': {
		id: 'webhook-signature-missing',
		why: 'Unsigned payment webhooks can let forged events grant access, cancel accounts, or mark unpaid subscriptions as paid.',
		detectedBy:
			'Scans repository payment code for Stripe-like webhook handlers and signature verification signals.',
		falsePositive:
			'Webhook handling may live in another private service; if so, keep the public repo from implying it owns payment fulfillment.'
	},
	'workflow-action-pinning': {
		id: 'workflow-action-pinning',
		why: 'Floating third-party GitHub Action refs can change CI behavior without code review when upstream branches move.',
		detectedBy:
			'Parses workflow uses references and warns on third-party actions pinned to main, master, latest, or other floating refs.',
		falsePositive:
			'First-party actions and carefully monitored tags may be acceptable, but high-security repositories often require SHA pinning.'
	},
	'workflow-immutable-action-pins': {
		id: 'workflow-immutable-action-pins',
		why: 'Full commit-SHA action pins make workflow dependencies immutable, reducing the chance that an upstream tag or release update silently changes CI behavior.',
		detectedBy:
			'Parses external GitHub Actions workflow uses references and verifies they are pinned to 40-character commit SHAs.',
		falsePositive:
			'Some teams intentionally accept trusted release tags for maintainability; hardened CI policies should document that exception and monitor updates.'
	},
	'webhook-event-coverage': {
		id: 'webhook-event-coverage',
		why: 'Payment webhooks must cover success, asynchronous completion, failed payments, and cancellation so access matches the real subscription state.',
		detectedBy:
			'Scans Stripe-like webhook handlers for checkout completion, async payment success or failure, invoice failure, and subscription deletion events.',
		falsePositive:
			'Some products use polling or provider-hosted fulfillment, but launch-critical subscription state changes still need a visible recovery path.'
	},
	'webhook-idempotency': {
		id: 'webhook-idempotency',
		why: 'Payment providers retry webhooks, so fulfillment handlers must dedupe event ids before granting, revoking, emailing, or provisioning paid access.',
		detectedBy:
			'Scans payment webhook handlers for idempotency, processed-event tables, event.id lookups, upserts, inserts, or conflict-safe storage before fulfillment.',
		falsePositive:
			'Idempotency may be enforced in a shared queue or private service not visible to the scanned repository; leave a clear processed-event handoff in payment code.'
	},
	'workflow-permissions': {
		id: 'workflow-permissions',
		why: 'Explicit GitHub Actions token permissions reduce the blast radius of compromised workflows or malicious pull requests.',
		detectedBy:
			'Scans workflow YAML for permissions declarations and flags missing or write-all permissions.',
		falsePositive:
			'Some jobs need write scopes to publish or comment; grant them only at the specific job that needs them.'
	},
	'workflow-pull-request-target': {
		id: 'workflow-pull-request-target',
		why: 'pull_request_target workflows can expose privileged tokens to untrusted pull-request input when checkout or shell usage is unsafe.',
		detectedBy:
			'Detects pull_request_target workflows and risky shell interpolation or unsafe PR checkout patterns.',
		falsePositive:
			'Read-only metadata workflows can use pull_request_target safely, but privileged tokens and untrusted code must stay separated.'
	},
	'wp-exposure': {
		id: 'wp-exposure',
		why: 'Exposed WordPress version and XML-RPC signals help automated attackers target known plugin and core vulnerabilities.',
		detectedBy:
			'Scans rendered HTML for WordPress asset paths, generator versions, pingback links, and XML-RPC exposure hints.',
		falsePositive:
			'Managed WordPress hosts can mitigate many risks, but hiding unnecessary version and XML-RPC signals remains useful hardening.'
	},
	'wrangler-compat-date': {
		id: 'wrangler-compat-date',
		why: 'A stale Cloudflare Workers compatibility date can leave runtime behavior behind current platform fixes and expectations.',
		detectedBy:
			'Parses wrangler configuration files and compares compatibility_date age against a freshness threshold.',
		falsePositive:
			'Compatibility dates should be updated deliberately with tests; old dates can be intentional during runtime migrations.'
	}
} satisfies Record<string, CheckCatalogEntry>;

export const CHECK_CATALOG = {
	...BASE_CHECK_CATALOG,
	...ADDITIONAL_CHECK_CATALOG
} satisfies Record<string, CheckCatalogEntry>;

export function getCheckCatalogEntry(id: string): CheckCatalogEntry | null {
	return Object.values(CHECK_CATALOG).find((entry) => entry.id === id) ?? null;
}

export function catalogEntries(): CheckCatalogEntry[] {
	return Object.values(CHECK_CATALOG).toSorted((a, b) => a.id.localeCompare(b.id));
}
