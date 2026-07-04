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

describe('parseBatchResults', () => {
	it('maps vulns back to their package by index', () => {
		const findings = parseBatchResults(PACKAGES, {
			results: [{ vulns: [{ id: 'GHSA-aaaa' }, { id: 'GHSA-bbbb' }] }, {}]
		});
		expect(findings).toEqual([
			{ package: 'lodash', version: '4.17.20', vulnIds: ['GHSA-aaaa', 'GHSA-bbbb'] }
		]);
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
		expect(normalizeSeverity(undefined)).toBeNull();
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

	it('returns null when OSV is unreachable — check is skipped, not faked', async () => {
		const fetchImpl: FetchLike = async () => {
			throw new Error('network down');
		};
		expect(await auditVulnerabilities(PACKAGES, fetchImpl)).toBeNull();
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
