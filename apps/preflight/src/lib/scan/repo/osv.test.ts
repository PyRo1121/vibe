import { describe, expect, it } from 'vitest';

import { auditVulnerabilities, normalizeSeverity, parseBatchResults } from './osv';
import type { FetchLike } from './osv';

const PACKAGES = [
	{ name: 'lodash', version: '4.17.20' },
	{ name: 'react', version: '18.2.0' }
];

function jsonResponse(body: unknown, ok = true): Response {
	return {
		ok,
		json: async () => body
	} as unknown as Response;
}

const unreachableFetch: FetchLike = async () => {
	throw new Error('network down');
};

describe('parseBatchResults', () => {
	it('maps vulns back to their package by index', () => {
		const findings = parseBatchResults(PACKAGES, {
			results: [{ vulns: [{ id: 'GHSA-aaaa' }, { id: 'GHSA-bbbb' }] }, {}]
		});
		expect(findings).toEqual([
			{ package: 'lodash', version: '4.17.20', vulnIds: ['GHSA-aaaa', 'GHSA-bbbb'] }
		]);
	});

	it('filters malformed vulnerability ids and ignores extra result rows', () => {
		const findings = parseBatchResults(PACKAGES, {
			results: [
				{ vulns: [{ id: '' }, { id: undefined }, { id: 'GHSA-valid' }] },
				{ vulns: [] },
				{ vulns: [{ id: 'GHSA-extra' }] }
			]
		});

		expect(findings).toEqual([{ package: 'lodash', version: '4.17.20', vulnIds: ['GHSA-valid'] }]);
	});

	it('handles null results and missing arrays', () => {
		expect(parseBatchResults(PACKAGES, { results: [null, null] })).toEqual([]);
		expect(parseBatchResults(PACKAGES, {})).toEqual([]);
	});
});

describe('normalizeSeverity', () => {
	it('accepts GHSA severity labels case-insensitively', () => {
		expect(normalizeSeverity('CRITICAL')).toBe('critical');
		expect(normalizeSeverity('Moderate')).toBe('moderate');
		expect(normalizeSeverity('bogus')).toBeNull();
		expect(normalizeSeverity()).toBeNull();
	});

	it('maps CVSS vectors to severity buckets', () => {
		expect(normalizeSeverity('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H')).toBe('critical');
		expect(normalizeSeverity('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:N')).toBe('high');
		expect(normalizeSeverity('CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:U/C:L/I:L/A:N')).toBe('moderate');
		expect(normalizeSeverity('CVSS:3.1/AV:P/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N')).toBe('low');
	});

	it('returns null for malformed or no-impact CVSS vectors', () => {
		expect(normalizeSeverity('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N')).toBeNull();
		expect(normalizeSeverity('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H')).toBeNull();
	});

	it('handles changed-scope CVSS vectors', () => {
		expect(normalizeSeverity('CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H')).toBe('critical');
	});
});

describe('auditVulnerabilities', () => {
	it('returns findings with worst severity from detail lookups', async () => {
		const fetchImpl: FetchLike = async (url) => {
			if (url.includes('querybatch')) {
				return jsonResponse({ results: [{ vulns: [{ id: 'GHSA-x' }] }, {}] });
			}
			return jsonResponse({ database_specific: { severity: 'HIGH' } });
		};
		const audit = await auditVulnerabilities(PACKAGES, fetchImpl);
		expect(audit).toEqual({
			checked: 2,
			findings: [{ package: 'lodash', version: '4.17.20', vulnIds: ['GHSA-x'] }],
			worstSeverity: 'high'
		});
	});

	it('uses top-level OSV severity entries from detail lookups', async () => {
		const fetchImpl: FetchLike = async (url) => {
			if (url.includes('querybatch')) {
				return jsonResponse({ results: [{ vulns: [{ id: 'GHSA-x' }] }, {}] });
			}
			return jsonResponse({
				severity: [{ type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:N' }]
			});
		};
		const audit = await auditVulnerabilities(PACKAGES, fetchImpl);
		expect(audit?.worstSeverity).toBe('high');
	});

	it('keeps the highest severity across sampled detail lookups and skips non-OK details', async () => {
		const fetchImpl: FetchLike = async (url) => {
			if (url.includes('querybatch')) {
				return jsonResponse({
					results: [
						{ vulns: [{ id: 'GHSA-low' }, { id: 'GHSA-broken' }, { id: 'GHSA-critical' }] },
						{}
					]
				});
			}
			if (url.endsWith('GHSA-low')) return jsonResponse({ database_specific: { severity: 'LOW' } });
			if (url.endsWith('GHSA-broken')) return jsonResponse({}, false);
			return jsonResponse({ database_specific: { severity: 'CRITICAL' } });
		};

		const audit = await auditVulnerabilities(PACKAGES, fetchImpl);

		expect(audit?.worstSeverity).toBe('critical');
	});

	it('returns null when OSV is unreachable — check is skipped, not faked', async () => {
		expect(await auditVulnerabilities(PACKAGES, unreachableFetch)).toBeNull();
		expect(await auditVulnerabilities(PACKAGES, async () => jsonResponse({}, false))).toBeNull();
	});

	it('still reports findings when severity details fail', async () => {
		const fetchImpl: FetchLike = async (url) => {
			if (url.includes('querybatch')) {
				return jsonResponse({ results: [{ vulns: [{ id: 'GHSA-x' }] }, {}] });
			}
			throw new Error('detail down');
		};
		const audit = await auditVulnerabilities(PACKAGES, fetchImpl);
		expect(audit?.findings).toHaveLength(1);
		expect(audit?.worstSeverity).toBeNull();
	});

	it('short-circuits on an empty package list without network calls', async () => {
		let called = false;
		const fetchImpl: FetchLike = async () => {
			called = true;
			return jsonResponse({});
		};
		expect(await auditVulnerabilities([], fetchImpl)).toEqual({
			checked: 0,
			findings: [],
			worstSeverity: null
		});
		expect(called).toBe(false);
	});
});
