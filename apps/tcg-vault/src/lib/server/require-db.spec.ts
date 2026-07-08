import { describe, expect, it } from 'vitest';

import { requireDb } from './require-db';

function captureError(run: () => unknown): unknown {
	try {
		return run();
	} catch (err) {
		return err;
	}
}

describe('requireDb', () => {
	it('returns the bound D1 database', () => {
		const db = { prepare: () => undefined };

		expect(requireDb({ env: { DB: db } } as unknown as App.Platform)).toBe(db);
	});

	it('throws a service error when DB is not bound', () => {
		expect(captureError(() => requireDb(undefined))).toMatchObject({
			body: { message: 'Database not bound' },
			status: 503
		});
	});
});
