import { describe, expect, it } from 'vitest';

import { UrlValidationError } from './url-guard';
import { parseScanRequestBody, assertJsonBodySize } from './validate';

describe('parseScanRequestBody', () => {
	it('returns trimmed https url', () => {
		expect(parseScanRequestBody({ url: '  https://app.test  ' }).url).toBe('https://app.test');
	});

	it('passes through unlock session id', () => {
		expect(
			parseScanRequestBody({ url: 'https://app.test', unlockSessionId: 'cs_test_abc' })
				.unlockSessionId
		).toBe('cs_test_abc');
	});

	it('passes through previous score for re-scan delta', () => {
		expect(
			parseScanRequestBody({ url: 'https://app.test', previousScore: 72.4 }).previousScore
		).toBe(72);
	});

	it('passes through safe project ids for workspace-backed CI reports', () => {
		expect(
			parseScanRequestBody({ url: 'https://app.test', projectId: '  proj_live-123  ' }).projectId
		).toBe('proj_live-123');
	});

	it('drops unsafe project ids instead of treating them as workspace context', () => {
		expect(
			parseScanRequestBody({ url: 'https://app.test', projectId: '../project;drop table' })
				.projectId
		).toBeUndefined();
	});

	it('rejects missing url', () => {
		expect(() => parseScanRequestBody({})).toThrow(UrlValidationError);
	});

	it('rejects blocked hosts', () => {
		expect(() => parseScanRequestBody({ url: 'https://127.0.0.1' })).toThrow(UrlValidationError);
	});
});

describe('assertJsonBodySize', () => {
	it('allows small bodies', () => {
		expect(() => assertJsonBodySize('100')).not.toThrow();
	});

	it('rejects oversized content-length', () => {
		expect(() => assertJsonBodySize('99999')).toThrow(UrlValidationError);
	});
});
