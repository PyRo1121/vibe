<svelte:head>
	<title>Privacy Policy — Deploylint</title>
</svelte:head>

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
			Payment status from Stripe if you purchase a fix-prompt unlock (no card data on our servers)
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
		We use <a class="text-sky-400 hover:underline" href="https://plausible.io">Plausible</a> on lint.latham.cloud
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
