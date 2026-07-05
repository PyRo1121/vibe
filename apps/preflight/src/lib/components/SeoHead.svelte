<script lang="ts">
	type JsonLd = Record<string, unknown>;

	let {
		title,
		description,
		canonical,
		image = 'https://deploylint.com/og.png',
		jsonLd = []
	}: {
		title: string;
		description: string;
		canonical: string;
		image?: string;
		jsonLd?: JsonLd[];
	} = $props();

	const jsonLdBodies = $derived(jsonLd.map((entry) => JSON.stringify(entry)));
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Deploylint" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={image} />
	<link rel="icon" href="/og.svg" type="image/svg+xml" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />
	{#each jsonLdBodies as body (body)}
		<svelte:element this={"script"} type="application/ld+json">{body}</svelte:element>
	{/each}
</svelte:head>
