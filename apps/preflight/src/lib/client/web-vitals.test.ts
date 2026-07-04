import { describe, expect, it } from 'vitest';
import { parsePsiResult, psiUrl } from './web-vitals';

describe('psiUrl', () => {
	it('builds a mobile performance request', () => {
		const url = new URL(psiUrl('https://app.test/'));
		expect(url.searchParams.get('url')).toBe('https://app.test/');
		expect(url.searchParams.get('strategy')).toBe('MOBILE');
	});
});

describe('parsePsiResult', () => {
	it('prefers CrUX field data and rates thresholds', () => {
		const result = parsePsiResult({
			lighthouseResult: {
				categories: { performance: { score: 0.93 } },
				audits: {
					'largest-contentful-paint': { numericValue: 9999 },
					'cumulative-layout-shift': { numericValue: 0.9 },
					'first-contentful-paint': { numericValue: 1200 },
					'total-blocking-time': { numericValue: 250 }
				}
			},
			loadingExperience: {
				metrics: {
					LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2100 },
					INTERACTION_TO_NEXT_PAINT: { percentile: 350 },
					CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 5 }
				}
			}
		});

		expect(result.performanceScore).toBe(93);
		const byId = Object.fromEntries(result.metrics.map((m) => [m.id, m]));
		expect(byId.lcp).toMatchObject({ display: '2.1 s', rating: 'good', field: true });
		expect(byId.inp).toMatchObject({ rating: 'needs-improvement', field: true });
		expect(byId.cls).toMatchObject({ display: '0.05', rating: 'good', field: true });
		expect(byId.fcp).toMatchObject({ rating: 'good', field: false });
		expect(byId.tbt).toMatchObject({ display: '250 ms', rating: 'needs-improvement' });
	});

	it('falls back to lab data when no field data exists', () => {
		const result = parsePsiResult({
			lighthouseResult: {
				categories: { performance: { score: 0.4 } },
				audits: {
					'largest-contentful-paint': { numericValue: 5200 },
					'cumulative-layout-shift': { numericValue: 0.31 }
				}
			}
		});
		const byId = Object.fromEntries(result.metrics.map((m) => [m.id, m]));
		expect(byId.lcp).toMatchObject({ display: '5.2 s', rating: 'poor', field: false });
		expect(byId.cls).toMatchObject({ display: '0.31', rating: 'poor', field: false });
		expect(byId.inp).toBeUndefined();
	});

	it('handles an empty response without crashing', () => {
		const result = parsePsiResult({});
		expect(result.performanceScore).toBeNull();
		expect(result.metrics).toEqual([]);
	});
});
