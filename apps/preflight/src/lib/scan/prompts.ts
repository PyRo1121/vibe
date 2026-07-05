import type { ScanCheck, ScanCoverage } from '$lib/scan/types';
import { sortChecksByPriority } from '$lib/scan/verdict';

/** Copy-paste AI fix prompts per check id. */
export function fixPrompt(id: string, context: { url: string; message?: string }): string {
	const { url, message } = context;
	const evidence = message ? `Evidence: ${message}\n` : '';
	const base = `Site: ${url}\nCheck: ${id}\n${evidence}\n`;
	const httpStatus = message?.match(/\bHTTP (\d{3})\b/)?.[1];
	const accessBlocked = httpStatus === '401' || httpStatus === '403';

	const templates: Record<string, string> = {
		reachable: accessBlocked
			? `${base}HTTP ${httpStatus} — the host blocked Deploylint's scanner or requires auth. If this is YOUR app: allow automated fetches (or whitelist User-Agent Deploylint/1.0), verify the homepage returns 200 to curl, then re-scan. Do not "fix" SEO/meta from this scan — we only saw an error page. Large enterprise sites often block scanners; Deploylint targets indie launches you control.`
			: `${base}The site returned an error or could not be fetched. Check DNS, hosting deploy status, SSL certificate, and that the domain is publicly accessible. Fix any 4xx/5xx on the homepage.`,
		fetch: `${base}The site returned an error or could not be fetched. Check DNS, hosting deploy status, SSL certificate, and that the domain is publicly accessible. Fix any 4xx/5xx on the homepage.`,
		https: `${base}Enable HTTPS on the hosting provider, force HTTP→HTTPS redirect, and verify all asset URLs use https://.`,
		title: `${base}Add a unique <title> under 60 characters: product name + primary benefit. Update src/app.html or the main layout head.`,
		description: `${base}Add <meta name="description" content="..."> with 120–160 characters describing who it's for and the outcome.`,
		'open-graph': `${base}Add og:title, og:description, and og:image meta tags so link previews look professional on X, Slack, and Discord. Verify og:image is absolute HTTPS URL, at least 1200×630.`,
		viewport: `${base}Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the document head.`,
		lang: `${base}Set <html lang="en"> (or appropriate locale) on the root HTML element.`,
		h1: `${base}Add exactly one H1 on the landing page stating what the product does in plain language.`,
		clarity: `${base}Rewrite hero section: who it's for, what it does, one primary CTA. Align H1, title, and meta description.`,
		privacy: `${base}Create a /privacy page and add a footer link before collecting emails or payments.`,
		terms: `${base}Create a /terms page and link it in the footer for paid products and trust.`,
		'license-risk': `${base}Third-party license issue affecting your right to sell this product. For each flagged library: (1) if it is GPL/AGPL or non-commercial, replace it with a permissive alternative (MIT/Apache/BSD) or buy the commercial license; (2) if it is dual-licensed (TinyMCE, CKEditor), purchase the commercial tier before charging money; (3) if the license is unknown, find the LICENSE file in its repository and confirm commercial use is allowed. Keep required license notices in your bundle. Do not launch a paid product with unresolved copyleft or non-commercial code.`,
		contact: `${base}Add /contact or mailto:support@yourdomain.com in the footer.`,
		'img-alt': `${base}Audit all <img> tags. Add descriptive alt text; use alt="" for decorative images only.`,
		secrets: `${base}Remove hardcoded secrets from client-side code. Move to server env vars. Rotate any exposed keys immediately.`,
		stripe: `${base}Verify Stripe: live secret keys only on server, webhooks signed, test checkout end-to-end, pricing page linked.`,
		paddle: `${base}Verify Paddle before launch: products/prices are live, webhook signatures are validated server-side, fulfillment only happens after paid/completed events, and tax/receipt settings are correct for your market.`,
		'lemon-squeezy': `${base}Verify Lemon Squeezy before launch: variants are live, license key delivery works if used, webhook signatures are checked server-side, and failed/refunded subscription events update access correctly.`,
		supabase: `${base}Enable Row Level Security on all Supabase tables. Add policies per role. Never expose service_role client-side.`,
		firebase: `${base}Review Firestore/Storage rules: deny by default, require auth for reads/writes.`,
		'auth-provider': `${base}Review production auth settings for the detected provider(s). Lock allowed redirect/callback URLs to your real domain, use production keys, set secure cookie/session settings, and test signup, login, logout, password reset, and protected-route access before launch.`,
		'error-monitoring': `${base}Confirm error monitoring is production-ready: release/environment tags are set, source maps are uploaded only if safe, alerts route to someone who will see them, and a test exception appears in the dashboard.`,
		'ai-client-api': `${base}AI provider API references appeared in client HTML. Verify no provider secret is shipped to the browser. Move OpenAI/Anthropic/Replicate/Hugging Face calls behind a server endpoint, add rate limits, log failures, and return only the minimum data the UI needs.`,
		links: `${base}Fix broken internal links found in navigation and footer. Verify each href resolves (no 404).`,
		robots: `${base}Add public/robots.txt allowing crawl of marketing pages; block /api if needed.`,
		favicon: `${base}Add <link rel="icon" href="/favicon.ico"> (or PNG/SVG) in the document head.`,
		'mixed-content': `${base}Update script, stylesheet, and image URLs to https:// or use protocol-relative paths only where safe.`,
		noindex: `${base}Remove meta name="robots" content="noindex" from the public homepage unless this is intentionally a staging URL.`,
		canonical: `${base}Add <link rel="canonical" href="${url}"> matching the primary public URL of this page.`,
		'twitter-card': `${base}Add twitter:card (summary_large_image), twitter:title, twitter:description, and twitter:image aligned with OG tags.`,
		'page-weight': `${base}Reduce HTML payload and defer non-critical scripts. Move analytics to after load; code-split heavy bundles.`,
		'hsts-header': `${base}Set Strict-Transport-Security on the host (Cloudflare SSL/TLS → HSTS, or server config). Include max-age and includeSubDomains if appropriate.`,
		'csp-header': `${base}Add a Content-Security-Policy header. Start with default-src 'self' and allowlist required CDNs/scripts.`,
		'clickjack-header': `${base}Set X-Frame-Options: DENY or SAMEORIGIN, or frame-ancestors in CSP.`,
		'mime-sniff-header': `${base}Set X-Content-Type-Options: nosniff on all HTML/asset responses.`,
		'referrer-header': `${base}Set Referrer-Policy: strict-origin-when-cross-origin (or stricter) on responses.`,
		'permissions-policy-header': `${base}Set Permissions-Policy to deny unused browser features, e.g. Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(). Cloudflare Transform Rules or your framework middleware can add this on every HTML response.`,
		sitemap: `${base}Add /sitemap.xml listing public marketing URLs and reference it in robots.txt.`,
		'og-image-live': `${base}Fix og:image — use an absolute HTTPS URL to a public image (1200×630 PNG/JPG). Verify the URL loads in a browser and returns 200.`,
		'og-image-type': `${base}og:image must return image/* content-type, not HTML. Point to a static PNG/JPG on your CDN or /public folder — not a SPA route that returns index.html.`,
		'placeholder-copy': `${base}Replace placeholder copy (Lorem ipsum, TODO, example.com, "Coming soon") with real product copy on the homepage and hero.`,
		'json-ld': `${base}Add JSON-LD structured data in the head — start with WebSite or SoftwareApplication schema describing name, URL, and description.`,
		'llms-txt': `${base}Add /llms.txt at the site root with a short markdown summary of your product, docs links, and what the site does for AI crawlers.`,
		'security-txt': `${base}Add RFC 9116 security.txt at /.well-known/security.txt (or /security.txt) with Contact: mailto:security@yourdomain.com and a link to your security policy. Security researchers and enterprise buyers look for this.`,
		'charset-meta': `${base}Add <meta charset="utf-8"> as the first element inside <head> so browsers decode text correctly on every page.`,
		analytics: `${base}Add analytics before launch — GA4 via gtag/GTM, or privacy-friendly Plausible/Fathom. Verify events fire on the homepage.`,
		'env-committed': `${base}A .env file is committed to this repository. (1) Remove it: git rm --cached <file> and commit. (2) Add .env* to .gitignore. (3) Rotate EVERY key that was in the file — treat them all as leaked, since git history keeps old commits. (4) If the repo is public, rotate immediately; scanners index GitHub within minutes. Use .env.example with placeholder values for documentation.`,
		'gitignore-env': `${base}Add a .gitignore entry excluding env files (.env, .env.*, !.env.example) plus node_modules/ and build output. Without it, one accidental "git add ." commits every secret.`,
		'dependency-vulns': `${base}Fix the known-vulnerable dependencies listed in the check message. (1) Run "npm audit" locally to see the full list with advisories. (2) Run "npm audit fix" for compatible upgrades. (3) For majors, bump the affected package manually and run your tests. (4) If a fix doesn't exist yet, check the advisory (osv.dev/<id>) for workarounds or replace the package. Re-scan to verify the vulnerabilities are gone.`,
		'repo-license': `${base}Resolve the repository license. If this is YOUR product: add a LICENSE file (MIT for open source, or keep all-rights-reserved for closed source — but say so in the README). If you are building ON this repo: read its LICENSE — GPL/AGPL can force you to open-source your product, and non-commercial licenses forbid selling. Replace copyleft code with permissive alternatives or buy a commercial license before charging money.`,
		readme: `${base}Write a real README: one-line description, what problem it solves, quickstart (install + run), deployment notes, and license. Aim for 100+ words — it is the landing page of the repo.`,
		'robots-block': `${base}Fix robots.txt — remove "Disallow: /" for User-agent: * unless this is intentionally private. Allow crawlers on public marketing pages.`,
		'redirect-chain': `${base}Reduce redirect hops — point DNS and canonical URL directly at the final HTTPS host to avoid chained 301s.`,
		'response-time': `${base}Reduce time-to-first-byte: enable caching/CDN for the homepage, avoid blocking server-side calls before first render (move data fetches client-side or cache them), and check hosting cold starts. Target < 1s for the first response.`,
		'not-found-page': `${base}Missing URLs return 200 instead of 404 (soft 404). Configure your SPA/host to return real 404s: add a catch-all route that sets status 404 with a custom not-found page (SvelteKit: +error.svelte, Next.js: not-found.tsx, Netlify/Vercel: 404 page). Soft 404s waste crawl budget and hide broken links from you.`,
		'email-auth': `${base}Add email authentication DNS records so transactional email reaches inboxes: (1) SPF TXT record on the sending domain, e.g. "v=spf1 include:<your-email-provider> ~all". (2) DMARC TXT record at _dmarc.<domain>, start with "v=DMARC1; p=none; rua=mailto:you@<domain>". (3) Enable DKIM in your email provider's dashboard. Verify with a test email to a Gmail address.`,
		'dkim-dns': `${base}Enable DKIM in your email provider (Resend, SendGrid, Postmark, Google Workspace, etc.) and publish their TXT record at the selector they specify — commonly default._domainkey.<your-domain> or google._domainkey.<your-domain>. SPF alone is often not enough for inbox placement.`,
		'cookie-consent': `${base}Cookie-based analytics (GA4/GTM/PostHog) are loading without a consent banner — an EU compliance risk. Either (a) add a consent-management banner (Cookiebot, CookieYes, or the open-source cookieconsent library) and only fire tracking scripts after opt-in, or (b) switch to a cookieless analytics tool (Plausible or Fathom) that needs no banner. Option (b) is less code and keeps the page cleaner.`,
		'apple-touch-icon': `${base}Add an apple-touch-icon so iOS home-screen bookmarks show your logo: create a 180x180 PNG (solid background, no transparency), save it as /apple-touch-icon.png, and add <link rel="apple-touch-icon" href="/apple-touch-icon.png"> to <head>.`,
		'host-consistency': `${base}Make both www and apex forms of the domain reach the site: add a DNS record for the missing host (CNAME www -> apex, or an apex ALIAS/ANAME), then a permanent 301 redirect from the non-canonical host to the canonical one (Cloudflare: Bulk Redirects or a redirect rule; Netlify/Vercel: domain settings handle this automatically). Pick one canonical form and redirect the other — do not serve the site on both.`,
		'form-labels': `${base}Associate every form input with a real label: <label for="email">Email</label><input id="email">, or wrap the input in the label, or add aria-label. Placeholder text is NOT a label — it vanishes on focus and screen readers skip it. Fix each flagged field and tab through the form with a screen reader (VoiceOver/NVDA) to verify.`,
		'accessible-names': `${base}Give every icon button and icon link an accessible name: add aria-label="Close" (or similar) to buttons whose only content is an SVG/icon, and alt text to linked images. Screen readers currently announce these as just "button"/"link" with no purpose. Search the codebase for <button> and target the ones without visible text.`,
		landmarks: `${base}Wrap the primary page content in a <main> element (one per page). Add <nav> around navigation and <footer> for the footer if missing. Landmarks let screen-reader users jump straight to content instead of tabbing through everything.`,
		'positive-tabindex': `${base}Remove tabindex values greater than 0 (tabindex="1", "2", …) — they hijack the natural tab order and make keyboard navigation unpredictable. Use tabindex="0" to make custom elements focusable in document order, or reorder the DOM if the visual order is wrong.`,
		'skip-link': `${base}Add a skip link as the FIRST focusable element in <body>: <a href="#main" class="sr-only focus:not-sr-only">Skip to content</a>, and give the main content id="main". Keyboard users currently tab through the entire nav on every page.`,
		'img-dimensions': `${base}Add width and height attributes (or CSS aspect-ratio) to every <img> so the browser reserves space before the image loads. Missing dimensions cause layout shift — the page jumps as images pop in, which hurts Core Web Vitals (CLS) and feels broken.`,
		'img-lazy': `${base}Add loading="lazy" to below-the-fold images so they don't compete with critical content on first paint. Keep the hero/LCP image eager (no loading attribute or loading="eager") — lazy-loading the largest visible image makes LCP worse.`,
		'font-loading': `${base}Add font-display: swap to every @font-face block (or &display=swap to Google Fonts URLs) so text renders immediately in a fallback font instead of staying invisible while custom fonts download.`,
		preconnect: `${base}Add <link rel="preconnect" href="https://<third-party-origin>" crossorigin> in <head> for each third-party origin the page loads assets from (fonts, CDNs, analytics). Preconnect performs DNS+TLS setup early, cutting 100-300ms off the first request to each origin.`,
		'blocking-css': `${base}Reduce render-blocking stylesheets in <head>: bundle them into one file, inline critical CSS, or load non-critical styles with media="print" onload-swap. Each blocking stylesheet delays first paint until it downloads.`,
		'inline-data-bloat': `${base}Trim the serialized state shipped inline in the HTML (framework hydration data). Only serialize what the first render needs — move the rest behind an API call. Oversized inline JSON inflates every page load and delays parsing.`,
		'heading-order': `${base}Fix the heading hierarchy so levels never skip (h1 → h2 → h3, not h1 → h3). Screen readers and search engines build the page outline from headings; skipped levels break that outline. Adjust the heading tags, not the visual styling — use CSS classes for size.`,
		'duplicate-meta': `${base}Give each page a unique <title> and meta description. Pages sharing identical metadata compete with each other in search results and look templated. In SvelteKit/Next, set title/description per route from the page component.`,
		hreflang: `${base}Fix hreflang tags: each value must be a valid language code (en, en-US) and multilingual sites should include <link rel="alternate" hreflang="x-default" href="..."> as the fallback. Invalid codes are ignored by Google entirely.`,
		'og-url-match': `${base}Set og:url to the canonical URL of the page it is on (matching the live URL). A mismatched og:url makes shares canonicalize to the wrong address — likes/shares split across URLs and analytics attribute wrong.`,
		'meta-keywords': `${base}Delete the <meta name="keywords"> tag. Google has ignored it since 2009; it only reveals your keyword strategy to competitors. No replacement needed.`,
		'title-brand-dupe': `${base}Fix the duplicated <title> — it currently repeats the same text around a separator ("Brand | Brand"). Use "Product name — what it does" instead; the title is your search-result headline.`,
		'form-security': `${base}CRITICAL: a form on this HTTPS page posts to http:// (or a password field exists on an http page). Credentials/PII would transit unencrypted and modern browsers block or warn on the submit. Change the form action to https:// (or a relative path), and force HTTPS site-wide with a redirect.`,
		sri: `${base}Add Subresource Integrity to third-party <script> tags: integrity="sha384-<hash>" crossorigin="anonymous". Generate hashes at srihash.org or via openssl. Without SRI, a compromised CDN executes arbitrary code on your page (this happened with polyfill.io in 2024). Alternatively, self-host the scripts.`,
		noopener: `${base}Add rel="noopener noreferrer" to external target="_blank" links. In older browsers the opened page gets window.opener access to your page (tab-nabbing). Most frameworks have a lint rule for this — enable it.`,
		'wp-exposure': `${base}Hide the WordPress version and disable xmlrpc: remove the generator meta tag (add remove_action('wp_head','wp_generator') to functions.php) and block xmlrpc.php (server rule or the Disable XML-RPC plugin) unless you use Jetpack/remote publishing. Exposed versions let attackers match known CVEs to your install.`,
		'mailto-exposure': `${base}Reduce raw email addresses in the page source — spam harvesters scrape them. Options: a contact form, an email obfuscation snippet (JS-assembled address), or at minimum accept the spam tradeoff knowingly. Keep one visible contact path either way.`,
		'ai-crawlers': `${base}Your robots.txt blocks AI crawlers (GPTBot, ClaudeBot, PerplexityBot, …), so AI assistants cannot read or cite your site — you will not appear in ChatGPT/Perplexity answers. If that is intentional (content protection), keep it. If discovery matters more, remove the Disallow rules for those user-agents. Decide deliberately; for a product launch, being invisible to AI search is usually a loss.`,
		'text-ratio': `${base}Almost none of the HTML is readable text — the content likely renders client-side only. Server-render (SSR/SSG) the marketing pages so crawlers and AI assistants see real content: SvelteKit/Next/Astro all support prerendering landing pages. Verify with: curl <url> | grep "<a real sentence from your hero>".`,
		'semantic-html': `${base}Replace generic <div>s with semantic elements for the page skeleton: <main> for content, <nav>, <header>, <footer>, <section> with headings, <article> for posts. Semantic structure is how AI crawlers, search engines, and assistive tech understand what matters on the page.`,
		'answer-signals': `${base}Give AI assistants and search engines something citable: (1) one plain-language sentence right after the H1 stating what the product does, (2) a meta description of 50+ chars, (3) optionally FAQPage JSON-LD for common questions. Without a citable summary, AI answers about your product will be vague or wrong.`,
		'og-site-name': `${base}Add <meta property="og:site_name" content="YourBrand"> so link unfurlers and AI assistants attribute content to your brand instead of the bare domain.`,
		'primary-cta': `${base}Put one clear call-to-action above the fold: a high-contrast button with an action verb ("Get started free", "Try the demo"). Launch-day visitors decide in seconds — if the next step isn't obvious immediately, they leave. One primary CTA, repeated at the bottom.`,
		'cta-competition': `${base}Too many competing calls-to-action — pick ONE primary action (usually signup or demo) and visually demote the rest to text links. Every additional button splits attention and lowers total conversion.`,
		'pricing-path': `${base}Add a pricing signal: a /pricing page or section, or at least "Free during beta" / "From $X/mo" near the CTA. "How much?" is the first question serious buyers ask, and silence reads as expensive-and-hiding-it.`,
		'social-proof': `${base}Add honest social proof near the CTA: 2-3 real user quotes with names, a usage number ("2,000 scans run"), notable users' logos, or a GitHub star count. At launch, even small honest numbers beat none — they signal the product is real and used.`,
		'signup-friction': `${base}Cut the signup form down — every extra required field drops completions measurably. Launch with email-only (or OAuth) and collect the rest after activation. You can always ask later; you cannot recover a bounced visitor.`,
		'copyright-year': `${base}Update the footer copyright year — a stale year reads as an abandoned project. Better: render it dynamically ({new Date().getFullYear()} in JSX/Svelte) so it never goes stale again.`,
		'dead-social-links': `${base}Fix or remove placeholder social links (icons pointing at twitter.com with no handle, href="#", or "yourhandle" URLs). Template leftovers destroy trust instantly. Link real profiles or delete the icons — an absent icon is better than a dead one.`,
		'broken-anchor-nav': `${base}Fix in-page anchor links that point at missing sections (href="#pricing" with no id="pricing" element) — clicking them does nothing. Add the matching id to the target section or correct the href. Also replace href="#" stub links with real destinations or buttons.`,
		'default-favicon-title': `${base}Replace template leftovers: set a real <title> (product name + benefit) and a real favicon. "Vite App" in the browser tab is the #1 tell of an unfinished launch — reviewers screenshot it.`,
		'last-updated-staleness': `${base}The page shows a stale "last updated" date. Either update the content and the date, or remove the timestamp entirely — a visible old date undermines trust more than no date.`,
		'package-scripts': `${base}Expose the core repo quality commands in root package.json: "lint", "test", and "build". In monorepos, root scripts can delegate to turbo, pnpm, npm, yarn, or bun workspaces, but a developer should be able to run one root command set before pushing.`,
		'lint-script': `${base}Wire linting into package.json. If ESLint is configured, add "lint": "eslint .". If Biome is configured, add "lint": "biome check .". Keep the command read-only; use a separate format command for writes.`,
		'format-script': `${base}Add a formatting command so contributors can normalize changes before pushing. Use "format": "prettier --write ." for Prettier or "format": "biome format --write ." for Biome.`,
		'typecheck-script': `${base}Add a typecheck command. For TypeScript apps use "typecheck": "tsc --noEmit". For SvelteKit use "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json". Run it in CI before build.`,
		'build-script': `${base}Add a real build script to root package.json, such as "build": "vite build", "build": "svelte-kit sync && vite build", or a monorepo command like "turbo run build". Do not use true or exit 0 as a placeholder.`,
		'package-manager-pinned': `${base}Pin the package manager in root package.json with Corepack, for example "packageManager": "pnpm@10.0.0" or "npm@11.0.0". The pinned manager should match the committed lockfile so installs are deterministic.`,
		'mixed-lockfiles': `${base}Pick one package manager and remove extra root lockfiles. npm uses package-lock.json, pnpm uses pnpm-lock.yaml, Yarn uses yarn.lock, and Bun uses bun.lock or bun.lockb. Commit exactly one root lockfile family for JavaScript projects.`,
		'ci-runs-quality-gates': `${base}Update CI so pull requests run the same quality gates a developer runs locally: install with the pinned package manager, then lint, typecheck/check, test, and build. Put fast checks before build so failures are obvious.`,
		'workflow-permissions': `${base}Reduce GitHub Actions token permissions. Set a workflow or job default like permissions: { contents: read }, then grant write scopes only to the one job that comments, publishes, or deploys.`,
		'workflow-pull-request-target': `${base}Review this pull_request_target workflow as a security issue. Do not run untrusted PR titles, bodies, comments, or branch code inside shell with privileged tokens. Move context values into environment variables, use a JavaScript action input, or switch to pull_request when write permissions are unnecessary.`,
		'workflow-action-pinning': `${base}Pin third-party GitHub Actions to a stable release tag or commit SHA. Avoid @main, @master, @latest, or moving branches for third-party actions because an upstream change can alter CI without review.`,
		'svelte-check': `${base}SvelteKit detected. Add svelte-check to devDependencies and expose "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json". This catches template, prop, and route typing issues that plain tsc misses.`,
		'deploy-config': `${base}Add deploy/runtime config to the repo when deployment is code-owned. For Cloudflare Workers use wrangler.jsonc, for Vercel use vercel.json when defaults are not enough, for Netlify use netlify.toml, and for containers include a Dockerfile plus .dockerignore.`,
		'wrangler-compat-date': `${base}Update Wrangler compatibility_date deliberately. Read Cloudflare runtime compatibility notes, choose a recent date, run the app's verify suite, deploy, and watch logs. Do not blindly update it without tests.`,
		'docker-env-copy': `${base}Remove dotenv files from the Docker image. Delete COPY .env lines, add .env and .env.* to .dockerignore, pass secrets at runtime through the hosting platform, and rotate any secret that was baked into an image.`,
		'ci-config': `${base}Add a CI workflow so every push is tested and built before deploy. Minimal GitHub Actions: .github/workflows/ci.yml running npm ci, npm test, npm run build on push/PR. This catches breakage before users see it — especially important when accepting AI-generated changes.`,
		'tests-present': `${base}Add at least smoke tests before launch: one test that the app builds and the critical path works (signup, checkout, core action). Without tests you cannot refactor or accept AI-generated changes safely. Start with Vitest/Jest for logic and one Playwright test for the happy path.`,
		'lockfile-committed': `${base}Commit the lockfile (package-lock.json / pnpm-lock.yaml / yarn.lock). Without it every install may resolve different versions — builds are unreproducible and supply-chain attacks via new releases go unnoticed. Remove the lockfile from .gitignore if it is listed, run npm install, commit the generated file.`,
		'node-version-pinned': `${base}Pin the Node version: add "engines": { "node": ">=20" } to package.json AND an .nvmrc file with the version (e.g. 20). Deploys and collaborators then fail fast on version mismatch instead of hitting mysterious runtime errors.`,
		'ts-strict': `${base}Enable strict mode in tsconfig.json: "compilerOptions": { "strict": true }. Fix the resulting errors incrementally (start with strictNullChecks). Without strict, TypeScript misses the null/undefined bugs it exists to catch.`,
		'exposed-env': `${base}Your /.env file is publicly downloadable. Remove it from static hosting immediately, rotate every secret that was in the file, and inject env vars at runtime only (Wrangler secrets, Vercel env, etc.). Never serve dotenv files as public assets.`,
		'exposed-git': `${base}The .git directory is exposed at /.git/HEAD. Block /.git in your CDN or reverse proxy (Cloudflare WAF, nginx deny), redeploy, and rotate any secrets ever committed to git history.`,
		'exposed-backup': `${base}A backup artifact (backup.zip or .env.bak) is publicly reachable. Delete it from the web root, block backup extensions in your CDN, and rotate credentials if the archive contained secrets.`,
		'exposed-package': `${base}Root package.json is publicly downloadable — it reveals dependency names and scripts to attackers. Serve the app from a build output directory that excludes package.json, or block direct access at the edge.`,
		'health-endpoint': `${base}Add a lightweight health endpoint: GET /health returning 200 and {"ok":true}. Wire it to uptime monitoring and your deploy gate so broken deploys are caught before users.`,
		'web-manifest': `${base}Add public/manifest.webmanifest and <link rel="manifest" href="/manifest.webmanifest"> with name, icons, and theme_color for PWA polish and mobile home-screen bookmarks.`,
		'debug-in-bundle': `${base}Remove console.log and debugger from production bundles. Enable build stripping (esbuild drop:['console','debugger']) or ensure NODE_ENV=production removes dev noise.`
	};

	return (
		templates[id] ?? `${base}Fix this launch readiness issue before sharing the site publicly.`
	);
}

/** One paste for Cursor/Claude — fixes all failing checks in priority order. */
export function buildMasterPrompt(
	checks: ScanCheck[],
	url: string,
	opts: { scanCoverage?: ScanCoverage; httpStatus?: number } = {}
): string {
	if (opts.scanCoverage === 'blocked') {
		const statusLabel = opts.httpStatus != null ? `HTTP ${opts.httpStatus}` : 'fetch failed';
		const reachability = checks.find((c) => c.id === 'reachable' || c.id === 'fetch');
		return [
			`Site: ${url}`,
			'',
			`Deploylint could not read your homepage (${statusLabel}). Content checks were skipped.`,
			'',
			'IMPORTANT: Do NOT fix SEO, privacy, OG tags, or analytics from this scan — those results came from an error/block page, not your real site.',
			'',
			reachability ? `Reachability: ${reachability.message}` : '',
			'',
			'If this is YOUR launch (a site you control):',
			'- Confirm the homepage returns HTTP 200 in a browser and to: curl -A "Deploylint/1.0" ' +
				url,
			'- If using Cloudflare/WAF, allow our scanner or test on a staging URL without bot rules',
			'- Re-run Deploylint after the homepage is reachable',
			'',
			'If this is a large third-party site (e.g. doordash.com), stop — Deploylint is for auditing apps you ship, not enterprise sites that block scanners.',
			'',
			'Rules:',
			'- Do not change meta tags based on this incomplete scan',
			'- Fix reachability / bot access first, then re-scan for a full audit'
		]
			.filter(Boolean)
			.join('\n');
	}

	const issues = sortChecksByPriority(checks);

	if (issues.length === 0) {
		return `Site: ${url}\n\nAll Deploylint checks passed. No fixes needed before sharing publicly.`;
	}

	const lines = issues.map(
		(c) => `- [${resolvePriorityLabel(c)}] ${c.title} (${c.status}): ${c.message}`
	);

	return [
		`You are fixing launch readiness for ${url}.`,
		'',
		'Fix these issues in order (P0 blockers first, then P1, then P2):',
		...lines,
		'',
		'Rules:',
		'- Make minimal, targeted changes',
		'- After each fix, confirm the related check would pass',
		'- Do not expose secrets client-side',
		'- Keep existing branding and layout unless a check requires copy changes'
	].join('\n');
}

/** Highest-priority failing check for free-tier sample prompt. */
export function pickSamplePromptCheck(
	checks: ScanCheck[],
	opts: { scanCoverage?: ScanCoverage } = {}
): ScanCheck | null {
	const pool =
		opts.scanCoverage === 'blocked'
			? checks.filter((c) => (c.id === 'reachable' || c.id === 'fetch') && c.fixPrompt)
			: checks.filter((c) => c.fixPrompt);
	const sorted = sortChecksByPriority(pool);
	return sorted[0] ?? null;
}

function resolvePriorityLabel(check: ScanCheck): string {
	return (check.priority ?? 'p2').toUpperCase();
}
