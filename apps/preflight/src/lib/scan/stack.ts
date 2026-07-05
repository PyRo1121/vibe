/**
 * Tech stack detection from homepage HTML and the final URL. Signature-based
 * and intentionally conservative — a wrong "Built with X" chip erodes trust
 * faster than a missing one.
 */

const HTML_RULES: Array<{ label: string; pattern: RegExp }> = [
	{ label: 'Next.js', pattern: /__NEXT_DATA__|\/_next\/static\// },
	{ label: 'Nuxt', pattern: /window\.__NUXT__|\/_nuxt\// },
	{ label: 'SvelteKit', pattern: /data-sveltekit-|\/_app\/immutable\// },
	{ label: 'Astro', pattern: /<astro-island\b/ },
	{ label: 'Remix', pattern: /window\.__remixContext/ },
	{ label: 'Gatsby', pattern: /id="___gatsby"/ },
	{ label: 'Angular', pattern: /\bng-version="/ },
	{ label: 'Vue', pattern: /\bdata-v-app\b/ },
	{ label: 'WordPress', pattern: /\/wp-content\/|\/wp-includes\// },
	{ label: 'Shopify', pattern: /cdn\.shopify\.com|Shopify\.theme/ },
	{ label: 'Webflow', pattern: /\bdata-wf-domain=|assets\.website-files\.com/ },
	{ label: 'Wix', pattern: /static\.parastorage\.com|wixstatic\.com/ },
	{ label: 'Squarespace', pattern: /Static\.SQUARESPACE_CONTEXT|static1\.squarespace\.com/ },
	{ label: 'Framer', pattern: /framerusercontent\.com/ },
	{ label: 'Ghost', pattern: /<meta name="generator" content="Ghost/ },
	{ label: 'Carrd', pattern: /carrd\.co\/assets/ },
	{ label: 'Lovable', pattern: /cdn\.gpteng\.co/ },
	{ label: 'Vercel', pattern: /\/_vercel\/insights|vercel\.live/ },
	{ label: 'Netlify', pattern: /netlify-identity-widget|\bdata-netlify\b/ },
	{ label: 'Cloudflare', pattern: /\/cdn-cgi\/(challenge-platform|beacon)/ },
	{ label: 'Stripe', pattern: /js\.stripe\.com|pk_(live|test)_/ },
	{ label: 'Paddle', pattern: /cdn\.paddle\.com|paddle\.js|paddle_billing|paddle\.checkout/i },
	{ label: 'Lemon Squeezy', pattern: /lemonsqueezy\.com|assets\.lemonsqueezy\.com|lemon\.js/i },
	{ label: 'Sentry', pattern: /browser\.sentry-cdn\.com|sentry\.io|@sentry\//i },
	{ label: 'LogRocket', pattern: /cdn\.logrocket\.io|logrocket\.init|logrocket\.com/i },
	{ label: 'PostHog', pattern: /app\.posthog\.com|posthog\.init|posthog-js/i },
	{ label: 'Plausible', pattern: /plausible\.io\/js|plausible\.trackevent/i },
	{ label: 'GA4', pattern: /googletagmanager\.com\/gtag\/js|gtag\(['"]config['"],\s*['"]G-/ },
	{ label: 'Google Tag Manager', pattern: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/ },
	{ label: 'Clerk', pattern: /js\.clerk\.com|clerk\.browser|@clerk\//i },
	{ label: 'Auth0', pattern: /cdn\.auth0\.com|auth0-spa-js|@auth0\//i },
	{ label: 'WorkOS', pattern: /workos\.com|@workos\//i },
	{ label: 'OpenAI', pattern: /api\.openai\.com\/v1|openai\.audio|openai\.chat|@openai\//i },
	{ label: 'Anthropic', pattern: /api\.anthropic\.com\/v1|anthropic\.messages|@anthropic-ai\//i },
	{ label: 'Replicate', pattern: /api\.replicate\.com\/v1|replicate\.run|@replicate\//i },
	{
		label: 'Hugging Face',
		pattern: /api-inference\.huggingface\.co|huggingface\.co\/api|@huggingface\//i
	}
];

const HOST_RULES: Array<{ label: string; pattern: RegExp }> = [
	{ label: 'Vercel', pattern: /\.vercel\.app$/ },
	{ label: 'Netlify', pattern: /\.netlify\.app$/ },
	{ label: 'Cloudflare Pages', pattern: /\.pages\.dev$/ },
	{ label: 'Cloudflare Workers', pattern: /\.workers\.dev$/ },
	{ label: 'GitHub Pages', pattern: /\.github\.io$/ },
	{ label: 'Lovable', pattern: /\.lovable\.app$/ },
	{ label: 'Replit', pattern: /\.replit\.app$|\.repl\.co$/ },
	{ label: 'Framer', pattern: /\.framer\.(app|website)$/ },
	{ label: 'Fly.io', pattern: /\.fly\.dev$/ },
	{ label: 'Railway', pattern: /\.up\.railway\.app$/ },
	{ label: 'Render', pattern: /\.onrender\.com$/ }
];

const MAX_STACK_ITEMS = 8;

export function detectStack(html: string, finalUrl: URL): string[] {
	const found: string[] = [];
	const seen = new Set<string>();
	const add = (label: string) => {
		if (seen.has(label)) return;
		seen.add(label);
		found.push(label);
	};

	for (const rule of HOST_RULES) {
		if (rule.pattern.test(finalUrl.hostname)) add(rule.label);
	}
	for (const rule of HTML_RULES) {
		if (rule.pattern.test(html)) add(rule.label);
	}

	// <meta name="generator"> names tools we have no signature for (Hugo, Jekyll, …).
	const generator = html.match(/<meta\s+name="generator"\s+content="([^"]{2,60})"/i)?.[1];
	if (generator) {
		const label = generator.trim();
		const firstWord = label.split(/[\s/]/)[0].toLowerCase();
		if (![...seen].some((s) => s.toLowerCase().startsWith(firstWord))) add(label);
	}

	return found.slice(0, MAX_STACK_ITEMS);
}
