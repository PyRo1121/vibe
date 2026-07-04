<script lang="ts">
	const appUrl = 'https://lint.latham.cloud';
</script>

<svelte:head>
	<title>Bad OG fixture</title>
	<meta property="og:title" content="Bad OG fixture" />
	<meta property="og:description" content="Smoke test page with broken og:image URL" />
	<meta property="og:image" content="{appUrl}/fixtures/missing-og-image.png" />
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="mx-auto max-w-lg px-4 py-16 text-zinc-400">
	<p>Internal smoke fixture — og:image points at a URL that 404s.</p>
</main>
