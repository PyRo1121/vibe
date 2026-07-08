import { describe, expect, it, vi } from 'vitest';

import {
	createDeploylintServer,
	createHandlers,
	gateZod,
	resolveFormat,
	scanZod
} from './server.js';
import type { ScanFetcher } from './server.js';
import type { ScanReport } from './types.js';

function report(overrides: Partial<ScanReport> = {}): ScanReport {
	return {
		url: 'https://app.test',
		finalUrl: 'https://app.test/',
		score: 72,
		verdict: 'no-go',
		verdictMessage: 'Fix blockers before gate mode',
		summary: { pass: 10, warn: 1, fail: 1 },
		checks: [
			{
				id: 'privacy',
				title: 'Privacy policy',
				status: 'fail',
				message: 'No privacy link',
				priority: 'p0',
				fixPrompt: 'Add /privacy.'
			}
		],
		reportId: 'abc12345',
		samplePromptId: 'privacy',
		...overrides
	};
}

function text(
	result: Awaited<ReturnType<ReturnType<typeof createHandlers>['handleScan']>>
): string {
	return result.content[0]?.text ?? '';
}

describe('MCP argument schemas', () => {
	it('bounds issue limits and score thresholds', () => {
		expect(scanZod.safeParse({ url: 'https://app.test', max_issues: 51 }).success).toBe(false);
		expect(gateZod.safeParse({ url: 'https://app.test', min_score: 101 }).success).toBe(false);
		expect(
			gateZod.safeParse({ url: 'https://app.test', max_issues: 5, min_score: 90 }).success
		).toBe(true);
	});
});

describe('resolveFormat', () => {
	it('defaults unknown or omitted formats to markdown', () => {
		expect(resolveFormat()).toBe('markdown');
		expect(resolveFormat('yaml')).toBe('markdown');
		expect(resolveFormat('json')).toBe('json');
	});
});

describe('MCP handlers', () => {
	it('returns structured JSON scan output and forwards unlock context', async () => {
		const scanFetcher = vi.fn<ScanFetcher>().mockResolvedValue(report());
		const handlers = createHandlers(scanFetcher);

		const result = await handlers.handleScan({
			url: 'https://app.test',
			format: 'json',
			max_issues: 1,
			unlock_session_id: 'cs_live_123',
			previous_score: 44
		});

		expect(scanFetcher).toHaveBeenCalledWith({
			url: 'https://app.test',
			unlockSessionId: 'cs_live_123',
			previousScore: 44
		});
		expect(JSON.parse(text(result))).toMatchObject({
			finalUrl: 'https://app.test/',
			issues: [{ id: 'privacy' }],
			reportUrl: expect.stringContaining('/r/abc12345')
		});
	});

	it('returns markdown scan output by default', async () => {
		const handlers = createHandlers(vi.fn<ScanFetcher>().mockResolvedValue(report()));

		const result = await handlers.handleScan({ url: 'https://app.test' });

		expect(text(result)).toContain('# Deploylint readiness review');
		expect(text(result)).toContain('Privacy policy');
	});

	it('keeps advisory gates non-blocking while reporting failures', async () => {
		const handlers = createHandlers(vi.fn<ScanFetcher>().mockResolvedValue(report()));

		const result = await handlers.handleGate({
			url: 'https://app.test',
			format: 'json',
			min_score: 90,
			advisory: true
		});

		expect(JSON.parse(text(result))).toMatchObject({
			pass: true,
			advisory: true,
			minScore: 90,
			reasons: expect.arrayContaining([
				expect.stringContaining('NO-GO'),
				expect.stringContaining('Score 72 below minimum 90'),
				expect.stringContaining('P0')
			])
		});
	});

	it('returns markdown gate output with default threshold and blocking behavior', async () => {
		const handlers = createHandlers(vi.fn<ScanFetcher>().mockResolvedValue(report()));

		const result = await handlers.handleGate({ url: 'https://app.test' });

		expect(text(result)).toContain('FAIL');
		expect(text(result)).toContain('Score 72 below minimum 80');
		expect(text(result)).toContain('Gate failures');
	});

	it('uses the default scan fetcher when no dependency is injected', () => {
		expect(createHandlers()).toHaveProperty('handleScan');
	});
});

describe('createDeploylintServer', () => {
	it('registers the Deploylint tool surface without connecting transport', () => {
		const server = createDeploylintServer(vi.fn<ScanFetcher>());

		expect(server).toBeDefined();
	});
});
