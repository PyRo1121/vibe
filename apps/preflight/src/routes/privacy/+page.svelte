<script lang="ts">
	import { resolve } from '$app/paths';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { buildPageJsonLd, buildSeoTitle, defaultSeoImage } from '$lib/site/seo-metadata';

	const base = 'https://deploylint.com';
	const title = buildSeoTitle('Privacy Policy');
	const description =
		'Deploylint privacy policy for workspaces, deploy target audits, report history, subscriptions, analytics, and data handling.';
	const canonical = `${base}/privacy`;
	const jsonLd = [buildPageJsonLd({ base, canonical, title, description })];
</script>

<SeoHead {title} {description} {canonical} image={defaultSeoImage(base)} {jsonLd} />

<div class="mx-auto max-w-3xl px-4 py-12 text-zinc-300">
	<h1 class="mb-2 text-3xl font-bold text-white">Privacy Policy</h1>
	<p class="mb-8 text-sm text-zinc-500">Last updated: July 2, 2026</p>

	<p class="mb-6">
		Deploylint checks deploy targets, public URLs, and repository signals you submit. Logged-in
		workspaces store project setup, advisory workflow state, report history, gate status, and
		subscription context so the product can operate as a CI hardening workspace.
	</p>

	<h2 class="mb-3 text-xl font-semibold text-white">What we collect</h2>
	<ul class="mb-6 list-disc space-y-2 pl-6">
		<li>Deploy target URLs, public report links, and public repository references you submit</li>
		<li>Workspace, project, gate policy, report history, and install-state records</li>
		<li>Account profile details from your sign-in provider, such as email, name, and avatar</li>
		<li>Basic request metadata (timestamp, IP) via our hosting provider</li>
		<li>
			Payment and subscription status from Stripe if you purchase a paid plan (no card data on our
			servers)
		</li>
	</ul>

	<h2 class="mb-3 text-xl font-semibold text-white">What we do not do</h2>
	<ul class="mb-6 list-disc space-y-2 pl-6">
		<li>We do not crawl your entire site beyond bounded deploy-readiness samples</li>
		<li>We do not store card numbers or raw payment credentials on Deploylint servers</li>
		<li>
			We do not intentionally collect private repository source unless you connect or submit it for
			a repo audit
		</li>
		<li>We do not sell your data</li>
	</ul>

	<h2 class="mb-3 text-xl font-semibold text-white">Retention</h2>
	<p class="mb-6">
		Workspace records, project settings, subscription state, and report history are retained while
		your workspace is active so the dashboard, advisory reports, and deploy gates can work. Public
		report links and one-off scan records may be retained for report access, abuse prevention,
		unlock verification, support, and diagnostics.
	</p>

	<h2 class="mb-3 text-xl font-semibold text-white">Analytics</h2>
	<p class="mb-6">
		We use <a class="text-sky-400 hover:underline" href="https://plausible.io">Plausible</a> on deploylint.com
		for privacy-friendly, cookieless traffic analytics and conversion goals (target audits, workspace
		setup, checkout, billing portal opens, and re-scans). Analytics uses Plausible's official browser
		library; funnel events send only aggregate fields such as verdict, score, plan, or mode and avoid
		personal data.
	</p>

	<h2 class="mb-3 text-xl font-semibold text-white">Contact</h2>
	<p class="mb-8">
		Questions: <a class="text-sky-400 hover:underline" href="mailto:support@latham.cloud"
			>support@latham.cloud</a
		>
	</p>

	<p><a class="text-sky-400 hover:underline" href={resolve('/')}>← Back to Deploylint</a></p>
</div>
