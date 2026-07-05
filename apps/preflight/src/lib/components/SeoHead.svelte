<script lang="ts">
	import { DEPLOYLINT_SEO } from '$lib/site/seo-metadata';
	import type { JsonLd } from '$lib/site/seo-metadata';

	let {
		title,
		description,
		canonical,
		image = 'https://deploylint.com/og.png',
		imageWidth = DEPLOYLINT_SEO.defaultImage.width,
		imageHeight = DEPLOYLINT_SEO.defaultImage.height,
		imageType = DEPLOYLINT_SEO.defaultImage.type,
		imageAlt = DEPLOYLINT_SEO.defaultImage.alt,
		robots = DEPLOYLINT_SEO.robots,
		jsonLd = []
	}: {
		title: string;
		description: string;
		canonical: string;
		image?: string;
		imageWidth?: number;
		imageHeight?: number;
		imageType?: string;
		imageAlt?: string;
		robots?: string;
		jsonLd?: JsonLd[];
	} = $props();

	const jsonLdBodies = $derived(jsonLd.map((entry) => JSON.stringify(entry)));
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta name="robots" content={robots} />
	<meta name="googlebot" content={robots} />
	<meta name="application-name" content={DEPLOYLINT_SEO.siteName} />
	<meta name="theme-color" content="#020617" />
	<link rel="canonical" href={canonical} />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content={DEPLOYLINT_SEO.locale} />
	<meta property="og:site_name" content={DEPLOYLINT_SEO.siteName} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={image} />
	<meta property="og:image:secure_url" content={image} />
	<meta property="og:image:type" content={imageType} />
	<meta property="og:image:width" content={String(imageWidth)} />
	<meta property="og:image:height" content={String(imageHeight)} />
	<meta property="og:image:alt" content={imageAlt} />
	<link rel="icon" href="/og.svg" type="image/svg+xml" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />
	<meta name="twitter:image:alt" content={imageAlt} />
	{#each jsonLdBodies as body (body)}
		<svelte:element this={"script"} type="application/ld+json">{body}</svelte:element>
	{/each}
</svelte:head>
