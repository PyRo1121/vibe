import type { LicenseCategory, Sellability } from '$lib/scan/types';

/**
 * Curated license database: package facts, CDN spellings, host rules, and
 * SPDX family classification. Pure data + lookup — the audit logic lives in
 * $lib/scan/license.
 */

export interface KnownLib {
	license: string;
	spdx: string | null;
	category: LicenseCategory;
	sellable: Sellability;
	note: string;
}

const PERMISSIVE = (
	license: string,
	spdx: string,
	note = 'Keep the license notice in your bundle.'
): KnownLib => ({
	license,
	spdx,
	category: 'permissive',
	sellable: 'yes',
	note
});

const MIT = PERMISSIVE('MIT', 'MIT');

/** Canonical package name → license facts. Names are lowercase. */
export const KNOWN: Record<string, KnownLib> = {
	jquery: MIT,
	'jquery-ui': MIT,
	react: MIT,
	'react-dom': MIT,
	vue: MIT,
	angular: MIT,
	svelte: MIT,
	bootstrap: MIT,
	tailwindcss: PERMISSIVE(
		'MIT',
		'MIT',
		'Play CDN is for prototyping — compile Tailwind for production builds.'
	),
	alpinejs: MIT,
	'htmx.org': PERMISSIVE('BSD 2-Clause', 'BSD-2-Clause'),
	lodash: MIT,
	underscore: MIT,
	moment: MIT,
	dayjs: MIT,
	axios: MIT,
	d3: PERMISSIVE('ISC', 'ISC'),
	'chart.js': MIT,
	three: MIT,
	leaflet: PERMISSIVE('BSD 2-Clause', 'BSD-2-Clause'),
	ol: PERMISSIVE('BSD 2-Clause', 'BSD-2-Clause'),
	'maplibre-gl': PERMISSIVE('BSD 3-Clause', 'BSD-3-Clause'),
	'video.js': PERMISSIVE('Apache 2.0', 'Apache-2.0'),
	plyr: MIT,
	'howler.js': MIT,
	'socket.io': MIT,
	marked: MIT,
	dompurify: PERMISSIVE('Apache 2.0 / MPL 2.0 (dual)', 'Apache-2.0'),
	prismjs: MIT,
	'highlight.js': PERMISSIVE('BSD 3-Clause', 'BSD-3-Clause'),
	katex: MIT,
	mathjax: PERMISSIVE('Apache 2.0', 'Apache-2.0'),
	'pdfjs-dist': PERMISSIVE('Apache 2.0', 'Apache-2.0'),
	quill: PERMISSIVE('BSD 3-Clause', 'BSD-3-Clause'),
	codemirror: MIT,
	'monaco-editor': MIT,
	sweetalert2: MIT,
	flatpickr: MIT,
	select2: MIT,
	'datatables.net': MIT,
	echarts: PERMISSIVE('Apache 2.0', 'Apache-2.0'),
	'plotly.js': MIT,
	recharts: MIT,
	swiper: MIT,
	'slick-carousel': MIT,
	aos: MIT,
	animejs: MIT,
	'typed.js': MIT,
	'particles.js': MIT,
	hammerjs: MIT,
	'@popperjs/core': MIT,
	'tippy.js': MIT,
	fullcalendar: PERMISSIVE(
		'MIT (core)',
		'MIT',
		'Core is MIT; FullCalendar Premium plugins require a paid license.'
	),
	'ag-grid-community': MIT,
	'animate.css': {
		license: 'Hippocratic 2.1',
		spdx: 'Hippocratic-2.1',
		category: 'weak-copyleft',
		sellable: 'conditions',
		note: 'Ethical-use license (not OSI-approved). Typical commercial products are fine; review the restrictions once.'
	},
	gsap: {
		license: 'GSAP Standard License',
		spdx: null,
		category: 'commercial',
		sellable: 'conditions',
		note: 'Free for commercial use since GSAP 3.13 — you can sell your product, but you cannot resell GSAP itself or build a competing animation tool.'
	},
	highcharts: {
		license: 'Highcharts License (CC BY-NC for non-commercial)',
		spdx: null,
		category: 'commercial',
		sellable: 'conditions',
		note: 'Free tier is NON-commercial only. Selling this product requires a paid Highcharts license.'
	},
	'ag-grid-enterprise': {
		license: 'AG Grid Enterprise (commercial)',
		spdx: null,
		category: 'commercial',
		sellable: 'conditions',
		note: 'Enterprise features require a paid AG Grid license before commercial use.'
	},
	tinymce: {
		license: 'GPLv2+ / commercial (dual)',
		spdx: 'GPL-2.0-or-later',
		category: 'strong-copyleft',
		sellable: 'conditions',
		note: 'Dual-licensed. Shipping a closed-source paid product requires the paid TinyMCE license — GPL otherwise applies to your code.'
	},
	ckeditor: {
		license: 'GPLv2+ / commercial (dual)',
		spdx: 'GPL-2.0-or-later',
		category: 'strong-copyleft',
		sellable: 'conditions',
		note: 'Dual-licensed. Closed-source commercial use requires a paid CKEditor license.'
	},
	'font-awesome': {
		license: 'Font Awesome Free (CC BY 4.0 icons, OFL fonts, MIT code)',
		spdx: null,
		category: 'permissive',
		sellable: 'yes',
		note: 'Free set is fine to sell with; Pro icons require a paid plan. Attribution is embedded in the files.'
	},
	'google-fonts': {
		license: 'OFL 1.1 / Apache 2.0',
		spdx: 'OFL-1.1',
		category: 'permissive',
		sellable: 'yes',
		note: 'Google Fonts are free for commercial use — no attribution required in the UI.'
	},
	'mapbox-gl': {
		license: 'Mapbox ToS (v2+) / BSD-3 (v1.x)',
		spdx: null,
		category: 'service',
		sellable: 'conditions',
		note: 'mapbox-gl v2+ is proprietary and requires a Mapbox account with billing. The maplibre-gl fork is BSD if you want out.'
	},
	'stripe-js': {
		license: 'Stripe Services Agreement',
		spdx: null,
		category: 'service',
		sellable: 'yes',
		note: 'Hosted service script — governed by Stripe terms, no code-license obligations on your product.'
	},
	'google-maps': {
		license: 'Google Maps Platform ToS',
		spdx: null,
		category: 'service',
		sellable: 'yes',
		note: 'Commercial use is fine under Google Maps Platform terms — requires an API key with billing enabled.'
	},
	'google-analytics': {
		license: 'Google terms (hosted service)',
		spdx: null,
		category: 'service',
		sellable: 'yes',
		note: 'Hosted analytics — disclose it in your privacy policy.'
	},
	plausible: {
		license: 'AGPL-3.0 (hosted service)',
		spdx: 'AGPL-3.0',
		category: 'service',
		sellable: 'yes',
		note: 'Using the hosted script does not affect your product license. Self-hosting Plausible is AGPL.'
	},
	'polyfill-io': {
		license: 'n/a — compromised CDN',
		spdx: null,
		category: 'unknown',
		sellable: 'risk',
		note: 'polyfill.io served malicious code in a 2024 supply-chain attack. Remove this script immediately regardless of licensing.'
	}
};

/** CDN / filename spellings → canonical KNOWN key. */
const ALIASES: Record<string, string> = {
	'twitter-bootstrap': 'bootstrap',
	'three.js': 'three',
	chartjs: 'chart.js',
	'anime.js': 'animejs',
	anime: 'animejs',
	howler: 'howler.js',
	fontawesome: 'font-awesome',
	'font-awesome-free': 'font-awesome',
	'popper.js': '@popperjs/core',
	popper: '@popperjs/core',
	htmx: 'htmx.org',
	datatables: 'datatables.net',
	openlayers: 'ol',
	videojs: 'video.js',
	'video-js': 'video.js',
	pdfjs: 'pdfjs-dist',
	'pdf.js': 'pdfjs-dist',
	'ag-grid': 'ag-grid-community',
	plotly: 'plotly.js',
	tailwind: 'tailwindcss',
	alpine: 'alpinejs',
	'alpine.js': 'alpinejs',
	tippy: 'tippy.js'
};

export const UNKNOWN_LIB: KnownLib = {
	license: 'Unknown',
	spdx: null,
	category: 'unknown',
	sellable: 'unknown',
	note: 'Not in our license database — check its repository LICENSE before selling.'
};

export function canonicalName(raw: string): string {
	const name = raw.toLowerCase();
	return ALIASES[name] ?? name;
}

/** Domain-level services where the URL itself identifies the "library". */
export const HOST_RULES: Array<{ pattern: RegExp; name: string }> = [
	{ pattern: /(^|\.)fonts\.googleapis\.com$|(^|\.)fonts\.gstatic\.com$/, name: 'google-fonts' },
	{ pattern: /(^|\.)kit\.fontawesome\.com$|(^|\.)use\.fontawesome\.com$/, name: 'font-awesome' },
	{ pattern: /^js\.stripe\.com$/, name: 'stripe-js' },
	{ pattern: /^maps\.googleapis\.com$/, name: 'google-maps' },
	{
		pattern: /(^|\.)googletagmanager\.com$|(^|\.)google-analytics\.com$/,
		name: 'google-analytics'
	},
	{ pattern: /^plausible\.io$/, name: 'plausible' },
	{ pattern: /(^|\.)polyfill\.io$/, name: 'polyfill-io' },
	{ pattern: /^cdn\.tailwindcss\.com$/, name: 'tailwindcss' }
];

export const SPDX_FAMILIES: Array<{
	pattern: RegExp;
	category: LicenseCategory;
	sellable: Sellability;
	note: string;
}> = [
	{
		pattern: /^AGPL/i,
		category: 'strong-copyleft',
		sellable: 'risk',
		note: 'AGPL — even serving this over a network can require open-sourcing your product. Replace it or open your source.'
	},
	{
		pattern: /^GPL/i,
		category: 'strong-copyleft',
		sellable: 'risk',
		note: 'GPL — shipping this in your client bundle can require releasing your own code under GPL. Replace or comply.'
	},
	{
		pattern: /^(LGPL|MPL|EPL|CDDL)/i,
		category: 'weak-copyleft',
		sellable: 'conditions',
		note: 'Weak copyleft — keep the library unmodified and separable, and share any changes you make to it.'
	},
	{
		pattern: /(-NC-?|NonCommercial)/i,
		category: 'noncommercial',
		sellable: 'risk',
		note: 'Non-commercial license — you cannot charge money for a product using this.'
	},
	{
		pattern: /^(MIT|ISC|BSD|Apache|0BSD|Unlicense|CC0|Zlib|OFL|WTFPL|Artistic)/i,
		category: 'permissive',
		sellable: 'yes',
		note: 'Permissive — keep the license notice in your bundle.'
	}
];
