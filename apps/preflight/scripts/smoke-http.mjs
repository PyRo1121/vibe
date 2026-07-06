const RETRYABLE_ERROR_CODES = new Set([
	'UND_ERR_CONNECT_TIMEOUT',
	'UND_ERR_HEADERS_TIMEOUT',
	'UND_ERR_BODY_TIMEOUT',
	'UND_ERR_SOCKET',
	'ECONNRESET',
	'ETIMEDOUT',
	'EAI_AGAIN',
	'ENOTFOUND'
]);
const FETCH_RETRY_INSTALLED = Symbol.for('deploylint.smokeFetchRetryInstalled');

function envInt(name, fallback) {
	const raw = process.env[name];
	if (!raw) return fallback;
	const value = Number.parseInt(raw, 10);
	return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function retryDelayMs(attempt, baseDelayMs) {
	return baseDelayMs * 2 ** attempt;
}

function causeCode(err) {
	const cause = err?.cause;
	if (cause && typeof cause === 'object' && 'code' in cause) return cause.code;
	if (err && typeof err === 'object' && 'code' in err) return err.code;
	return undefined;
}

function describeFetchError(err) {
	const code = causeCode(err);
	if (typeof code === 'string') return code;
	return err instanceof Error ? err.message : String(err);
}

function describeFetchInput(input) {
	if (typeof input === 'string') return input;
	if (input instanceof URL) return input.href;
	return input?.url ?? 'request';
}

function isRetryableFetchError(err) {
	const code = causeCode(err);
	if (typeof code === 'string' && RETRYABLE_ERROR_CODES.has(code)) return true;
	if (!(err instanceof Error)) return false;
	return /fetch failed|connect timeout|network|timed out/i.test(err.message);
}

export function installFetchRetry({
	retries = envInt('DEPLOYLINT_SMOKE_FETCH_RETRIES', 2),
	baseDelayMs = envInt('DEPLOYLINT_SMOKE_FETCH_RETRY_DELAY_MS', 500)
} = {}) {
	const originalFetch = globalThis.fetch;
	if (typeof originalFetch !== 'function') {
		throw new Error('global fetch is not available');
	}
	if (globalThis[FETCH_RETRY_INSTALLED]) return;

	async function fetchWithRetry(input, init) {
		for (let attempt = 0; ; attempt += 1) {
			try {
				return await originalFetch.call(globalThis, input, init);
			} catch (err) {
				if (attempt >= retries || !isRetryableFetchError(err)) throw err;

				const delayMs = retryDelayMs(attempt, baseDelayMs);
				console.warn(
					`[smoke] fetch retry ${attempt + 1}/${retries} in ${delayMs}ms after ${describeFetchError(err)} for ${describeFetchInput(input)}`
				);
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}
	}

	globalThis.fetch = fetchWithRetry;
	globalThis[FETCH_RETRY_INSTALLED] = true;
}
