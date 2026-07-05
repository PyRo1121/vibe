export type JsonLd = Record<string, unknown>;

export const DEPLOYLINT_SEO = {
	siteName: 'Deploylint',
	language: 'en-US',
	locale: 'en_US',
	robots: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
	defaultImage: {
		path: '/og.png',
		width: 1200,
		height: 630,
		type: 'image/png',
		alt: 'Deploylint launch readiness scanner'
	}
} as const;

export function normalizeBase(base: string): string {
	return base.replace(/\/+$/, '');
}

export function buildSeoTitle(title: string): string {
	const trimmed = title.trim();
	if (trimmed === DEPLOYLINT_SEO.siteName || trimmed.startsWith(`${DEPLOYLINT_SEO.siteName} `)) {
		return trimmed;
	}

	return `${trimmed} - ${DEPLOYLINT_SEO.siteName}`;
}

export function defaultSeoImage(base: string): string {
	return `${normalizeBase(base)}${DEPLOYLINT_SEO.defaultImage.path}`;
}

export function buildPageJsonLd({
	base,
	canonical,
	title,
	description,
	type = 'WebPage'
}: {
	base: string;
	canonical: string;
	title: string;
	description: string;
	type?: string;
}): JsonLd {
	const root = normalizeBase(base);
	return {
		'@context': 'https://schema.org',
		'@type': type,
		name: title,
		url: canonical,
		description,
		inLanguage: DEPLOYLINT_SEO.language,
		isPartOf: {
			'@id': `${root}/#website`
		},
		publisher: {
			'@id': `${root}/#organization`
		}
	};
}

export function buildDeploylintJsonLd({
	base,
	description,
	price
}: {
	base: string;
	description: string;
	price: string;
}): JsonLd[] {
	const root = normalizeBase(base);
	const logo = defaultSeoImage(root);

	return [
		{
			'@context': 'https://schema.org',
			'@type': 'Organization',
			'@id': `${root}/#organization`,
			name: DEPLOYLINT_SEO.siteName,
			url: `${root}/`,
			logo,
			image: logo
		},
		{
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			'@id': `${root}/#website`,
			name: DEPLOYLINT_SEO.siteName,
			url: `${root}/`,
			description,
			inLanguage: DEPLOYLINT_SEO.language,
			publisher: {
				'@id': `${root}/#organization`
			}
		},
		{
			'@context': 'https://schema.org',
			'@type': 'WebApplication',
			'@id': `${root}/#app`,
			name: DEPLOYLINT_SEO.siteName,
			url: `${root}/`,
			description,
			applicationCategory: 'DeveloperApplication',
			operatingSystem: 'Web',
			inLanguage: DEPLOYLINT_SEO.language,
			publisher: {
				'@id': `${root}/#organization`
			},
			offers: {
				'@type': 'Offer',
				price,
				priceCurrency: 'USD',
				availability: 'https://schema.org/InStock',
				url: `${root}/`
			}
		}
	];
}
