import { beforeEach, describe, expect, it, vi } from 'vitest';

const syncMocks = vi.hoisted(() => ({
	importScryfallSet: vi.fn<(db: unknown, code: string) => Promise<void>>()
}));

vi.mock('$lib/server/sync/scryfall', () => ({
	importScryfallSet: syncMocks.importScryfallSet
}));

type CodeQuery = { all: () => Promise<{ results: Array<{ code: string | null }> }> };

function createEnv(codes: Array<{ code: string | null }>) {
	return {
		DB: {
			prepare: vi.fn<(sql: string) => CodeQuery>(() => ({
				all: vi.fn<() => Promise<{ results: Array<{ code: string | null }> }>>(async () => ({
					results: codes
				}))
			}))
		}
	} as unknown as Env;
}

describe('runScheduledSync', () => {
	beforeEach(() => {
		syncMocks.importScryfallSet.mockReset();
	});

	it('does nothing when DB is unavailable', async () => {
		const { runScheduledSync } = await import('./scheduled');

		await runScheduledSync({} as Env);
		expect(syncMocks.importScryfallSet).not.toHaveBeenCalled();
	});

	it('imports the recent set codes and skips empty rows', async () => {
		const { runScheduledSync } = await import('./scheduled');
		const env = createEnv([{ code: 'lea' }, { code: '' }, { code: '2ed' }]);

		await runScheduledSync(env);
		expect(syncMocks.importScryfallSet).toHaveBeenCalledTimes(2);
		expect(syncMocks.importScryfallSet).toHaveBeenNthCalledWith(1, env.DB, 'lea');
		expect(syncMocks.importScryfallSet).toHaveBeenNthCalledWith(2, env.DB, '2ed');
	});

	it('continues scheduled sync after one set import fails', async () => {
		const { runScheduledSync } = await import('./scheduled');
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		syncMocks.importScryfallSet.mockRejectedValueOnce(new Error('Scryfall down'));
		const env = createEnv([{ code: 'lea' }, { code: '2ed' }]);

		try {
			await runScheduledSync(env);
			expect(syncMocks.importScryfallSet).toHaveBeenCalledTimes(2);
			expect(consoleError).toHaveBeenCalledWith('Scryfall sync failed for lea:', expect.any(Error));
		} finally {
			consoleError.mockRestore();
		}
	});
});
