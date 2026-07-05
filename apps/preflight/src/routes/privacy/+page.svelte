<script lang="ts">
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { buildPageJsonLd, buildSeoTitle, defaultSeoImage } from '$lib/site/seo-metadata';

	const base = 'https://deploylint.com';
	const title = buildSeoTitle('Privacy Policy');
	const description =
		'Deploylint privacy policy for public URL scans, subscriptions, analytics, and data handling.';
	const canonical = `${base}/privacy`;
	const jsonLd = [buildPageJsonLd({ base, canonical, title, description })];
</script>

<SeoHead {title} {description} {canonical} image={defaultSeoImage(base)} {jsonLd} />

<div class="mx-auto max-w-3xl px-4 py-12 text-zinc-300">
	<h1 class="mb-2 text-3xl font-bold text-white">Privacy Policy</h1>
	<p class="mb-8 text-sm text-zinc-500">Last updated: July 2, 2026</p>

	<p class="mb-6">
		Deploylint scans public URLs you submit. We fetch your page HTML to run readiness checks. We do
		not require an account for the free scan.
	</p>

	<h2 class="mb-3 text-xl font-semibold text-white">What we collect</h2>
	<ul class="mb-6 list-disc space-y-2 pl-6">
		<li>The URL you submit for scanning</li>
		<li>Basic request metadata (timestamp, IP) via our hosting provider</li>
		<li>
			Payment and subscription status from Stripe if you purchase a paid plan (no card data on our
			servers)
		</li>
	</ul>

	<h2 class="mb-3 text-xl font-semibold text-white">What we do not do</h2>
	<ul class="mb-6 list-disc space-y-2 pl-6">
		<li>We do not crawl your entire site beyond a bounded sample of links on the homepage</li>
		<li>We do not sell your data</li>
		<li>We do not store scan history long-term in the MVP</li>
	</ul>

	<h2 class="mb-3 text-xl font-semibold text-white">Analytics</h2>
	<p class="mb-6">
		We use <a class="text-sky-400 hover:underline" href="https://plausible.io">Plausible</a> on deploylint.com
		for privacy-friendly, cookieless traffic analytics and conversion goals (free scans, unlock clicks,
		re-scans). Analytics uses Plausible’s official browser library; funnel events send only aggregate
		fields (verdict, score) — no personal data.
	</p>

	<h2 class="mb-3 text-xl font-semibold text-white">Contact</h2>
	<p class="mb-8">
		Questions: <a class="text-sky-400 hover:underline" href="mailto:support@latham.cloud"
			>support@latham.cloud</a
		>
	</p>

	<p><a class="text-sky-400 hover:underline" href="/">← Back to Deploylint</a></p>
</div>
