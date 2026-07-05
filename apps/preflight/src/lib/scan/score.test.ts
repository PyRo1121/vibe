import { describe, expect, it } from 'vitest';

import { makeCheck, scoreChecks } from './score';

describe('scoreChecks', () => {
	it('caps score when site is unreachable', () => {
		const checks = [
			makeCheck('reachable', 'launch', 'Site reachable', 'fail', 'HTTP 500', 'fix'),
			makeCheck('https', 'security', 'HTTPS', 'pass', 'ok', 'fix')
		];
		expect(scoreChecks(checks)).toBeLessThanOrEqual(25);
	});
});
