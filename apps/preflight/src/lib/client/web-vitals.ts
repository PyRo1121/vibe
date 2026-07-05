/**
 * Core Web Vitals via Google PageSpeed Insights, fetched from the visitor's
 * browser so the main scan stays fast and the server pays no quota. Keyless
 * PSI access is rate limited per client IP, which distributes naturally.
 */

export type VitalRating = 'good' | 'needs-improvement' | 'poor';

export interface VitalMetric {
	id: string;
	label: string;
	/** Human-formatted value, e.g. "2.1 s" or "0.02". */
	display: string;
	rating: VitalRating;
	/** True when it comes from CrUX field data (real users) vs lab. */
	field: boolean;
}

export interface WebVitalsResult {
	/** Lighthouse performance score 0-100, or null when missing. */
	performanceScore: number | null;
	metrics: VitalMetric[];
	fetchedAt: string;
}

export function psiUrl(targetUrl: string): string {
	const u = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
	u.searchParams.set('url', targetUrl);
	u.searchParams.set('category', 'PERFORMANCE');
	u.searchParams.set('strategy', 'MOBILE');
	return u.href;
}

function rate(value: number, good: number, poor: number): VitalRating {
	if (value <= good) return 'good';
	if (value <= poor) return 'needs-improvement';
	return 'poor';
}

function ms(value: number): string {
	return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`;
}

interface PsiAudit {
	numericValue?: number;
}

export interface PsiResponse {
	lighthouseResult?: {
		categories?: { performance?: { score?: number | null } };
		audits?: Record<string, PsiAudit | undefined>;
	};
	loadingExperience?: {
		metrics?: Record<string, { percentile?: number } | undefined>;
	};
}

/** Distills a PSI response into the metrics worth showing. */
export function parsePsiResult(body: PsiResponse): WebVitalsResult {
	const metrics: VitalMetric[] = [];
	const fieldMetrics = body.loadingExperience?.metrics ?? {};
	const audits = body.lighthouseResult?.audits ?? {};

	const fieldLcp = fieldMetrics['LARGEST_CONTENTFUL_PAINT_MS']?.percentile;
	const labLcp = audits['largest-contentful-paint']?.numericValue;
	const lcp = fieldLcp ?? labLcp;
	if (lcp != null) {
		metrics.push({
			id: 'lcp',
			label: 'Largest Contentful Paint',
			display: ms(lcp),
			rating: rate(lcp, 2500, 4000),
			field: fieldLcp != null
		});
	}

	const inp = fieldMetrics['INTERACTION_TO_NEXT_PAINT']?.percentile;
	if (inp != null) {
		metrics.push({
			id: 'inp',
			label: 'Interaction to Next Paint',
			display: ms(inp),
			rating: rate(inp, 200, 500),
			field: true
		});
	}

	const fieldCls = fieldMetrics['CUMULATIVE_LAYOUT_SHIFT_SCORE']?.percentile;
	const labCls = audits['cumulative-layout-shift']?.numericValue;
	// CrUX reports CLS ×100 as an integer percentile.
	const cls = fieldCls == null ? labCls : fieldCls / 100;
	if (cls != null) {
		metrics.push({
			id: 'cls',
			label: 'Cumulative Layout Shift',
			display: cls.toFixed(2),
			rating: rate(cls, 0.1, 0.25),
			field: fieldCls != null
		});
	}

	const fcp = audits['first-contentful-paint']?.numericValue;
	if (fcp != null) {
		metrics.push({
			id: 'fcp',
			label: 'First Contentful Paint',
			display: ms(fcp),
			rating: rate(fcp, 1800, 3000),
			field: false
		});
	}

	const tbt = audits['total-blocking-time']?.numericValue;
	if (tbt != null) {
		metrics.push({
			id: 'tbt',
			label: 'Total Blocking Time',
			display: ms(tbt),
			rating: rate(tbt, 200, 600),
			field: false
		});
	}

	const rawScore = body.lighthouseResult?.categories?.performance?.score;
	return {
		performanceScore: rawScore == null ? null : Math.round(rawScore * 100),
		metrics,
		fetchedAt: new Date().toISOString()
	};
}
