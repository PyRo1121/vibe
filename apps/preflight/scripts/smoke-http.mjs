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

/**
 * @param {string} name
 * @param {number} fallback
 */
function envInt(name, fallback) {
	const raw = process.env[name];
	if (!raw) return fallback;
	const value = Number.parseInt(raw, 10);
	return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * @param {number} attempt
 * @param {number} baseDelayMs
 */
function retryDelayMs(attempt, baseDelayMs) {
	return baseDelayMs * 2 ** attempt;
}

/**
 * @param {unknown} err
 * @returns {string | undefined}
 */
function causeCode(err) {
	const cause =
		err instanceof Error
			? err.cause
			: err && typeof err === 'object' && 'cause' in err
				? err.cause
				: undefined;
	if (cause && typeof cause === 'object' && 'code' in cause) {
		const { code } = cause;
		return typeof code === 'string' ? code : undefined;
	}
	if (err && typeof err === 'object' && 'code' in err) {
		const { code } = err;
		return typeof code === 'string' ? code : undefined;
	}
	return undefined;
}

/**
 * @param {unknown} err
 */
function describeFetchError(err) {
	const code = causeCode(err);
	if (typeof code === 'string') return code;
	return err instanceof Error ? err.message : String(err);
}

/**
 * @param {RequestInfo | URL} input
 */
function describeFetchInput(input) {
	if (typeof input === 'string') return input;
	if (input instanceof URL) return input.href;
	return input?.url ?? 'request';
}

/**
 * @param {unknown} err
 */
function isRetryableFetchError(err) {
	const code = causeCode(err);
	if (typeof code === 'string' && RETRYABLE_ERROR_CODES.has(code)) return true;
	if (!(err instanceof Error)) return false;
	return /fetch failed|connect timeout|network|timed out/i.test(err.message);
}

/**
 * @param {Response | number | undefined} responseOrStatus
 * @param {string} [text]
 */
export function isScanRateLimitedResponse(responseOrStatus, text = '') {
	const status = typeof responseOrStatus === 'number' ? responseOrStatus : responseOrStatus?.status;
	return status === 429 && /too many (scans|advisory previews)/i.test(text);
}

/**
 * @param {Response | number | undefined} responseOrStatus
 * @param {string} [text]
 */
export function scanLimitReason(responseOrStatus, text = '') {
	const status = typeof responseOrStatus === 'number' ? responseOrStatus : responseOrStatus?.status;
	if (status === 429 && /too many (scans|advisory previews)/i.test(text)) {
		return 'advisory preview rate limit active after earlier smoke phases';
	}
	if (
		status === 503 &&
		/(daily scan capacity reached|advisory preview capacity reached)/i.test(text)
	) {
		return 'advisory preview capacity reached; retry preview assertions after midnight UTC';
	}
	return null;
}

/**
 * @param {Response | number | undefined} responseOrStatus
 * @param {string} [text]
 */
export function isScanLimitedResponse(responseOrStatus, text = '') {
	return scanLimitReason(responseOrStatus, text) !== null;
}

/**
 * @param {{ retries?: number; baseDelayMs?: number }} [opts]
 */
export function installFetchRetry({
	retries = envInt('DEPLOYLINT_SMOKE_FETCH_RETRIES', 2),
	baseDelayMs = envInt('DEPLOYLINT_SMOKE_FETCH_RETRY_DELAY_MS', 500)
} = {}) {
	const originalFetch = globalThis.fetch;
	const retryGlobal =
		/** @type {typeof globalThis & Record<symbol, boolean | undefined>} */ (globalThis);
	if (typeof originalFetch !== 'function') {
		throw new Error('global fetch is not available');
	}
	if (retryGlobal[FETCH_RETRY_INSTALLED]) return;

	/**
	 * @param {RequestInfo | URL} input
	 * @param {RequestInit} [init]
	 */
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
	retryGlobal[FETCH_RETRY_INSTALLED] = true;
}
