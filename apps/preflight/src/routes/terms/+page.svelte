<script lang="ts">
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { buildPageJsonLd, buildSeoTitle, defaultSeoImage } from '$lib/site/seo-metadata';

	const base = 'https://deploylint.com';
	const title = buildSeoTitle('Terms of Service');
	const description =
		'Deploylint terms for automated launch-readiness scans, paid subscriptions, acceptable use, and refund handling.';
	const canonical = `${base}/terms`;
	const jsonLd = [buildPageJsonLd({ base, canonical, title, description })];
</script>

<SeoHead {title} {description} {canonical} image={defaultSeoImage(base)} {jsonLd} />

<div class="mx-auto max-w-3xl px-4 py-12 text-zinc-300">
	<h1 class="mb-2 text-3xl font-bold text-white">Terms of Service</h1>
	<p class="mb-8 text-sm text-zinc-500">Last updated: July 5, 2026</p>

	<p class="mb-6">
		Deploylint provides automated site readiness checks and optional AI fix prompts. Results are
		informational — not legal, security, or compliance advice.
	</p>

	<h2 class="mb-3 text-xl font-semibold text-white">Acceptable use</h2>
	<ul class="mb-6 list-disc space-y-2 pl-6">
		<li>Only scan URLs you own or have permission to test</li>
		<li>Do not use Deploylint to attack, overload, or probe third-party systems</li>
	</ul>

	<h2 class="mb-3 text-xl font-semibold text-white">Payments</h2>
	<p class="mb-6">
		Paid plans are recurring monthly subscriptions for the selected tier. Free scans remain
		available. Refunds and cancellations are handled case by case via support.
	</p>

	<h2 class="mb-3 text-xl font-semibold text-white">Disclaimer</h2>
	<p class="mb-6">
		We do our best, but automated scans can miss issues or flag false positives. You are responsible
		for your launch decisions.
	</p>

	<h2 class="mb-3 text-xl font-semibold text-white">Contact</h2>
	<p class="mb-8">
		Questions: <a class="text-sky-400 hover:underline" href="mailto:support@latham.cloud"
			>support@latham.cloud</a
		>
	</p>

	<p><a class="text-sky-400 hover:underline" href="/">← Back to Deploylint</a></p>
</div>
