export const INDEXNOW_KEY = '6da582af5bd7494883be38e960f0f53f';
export const INDEXNOW_HOST = 'deploylint.com';
export const INDEXNOW_KEY_LOCATION = `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`;

const EXCLUDED_PREFIXES = ['/api/', '/r/', '/s/', '/fixtures/'];

export interface IndexNowPayload {
	host: string;
	key: string;
	keyLocation: string;
	urlList: string[];
}

export function isDeploylintCanonicalUrl(rawUrl: string): boolean {
	try {
		const url = new URL(rawUrl);
		if (url.protocol !== 'https:') return false;
		if (url.hostname !== INDEXNOW_HOST) return false;
		return !EXCLUDED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
	} catch {
		return false;
	}
}

export function extractSitemapUrls(xml: string): string[] {
	const matches = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
		.map((match) => match[1].trim())
		.filter(isDeploylintCanonicalUrl);

	return [...new Set(matches)];
}

export function buildIndexNowPayload(urls: Iterable<string>): IndexNowPayload {
	return {
		host: INDEXNOW_HOST,
		key: INDEXNOW_KEY,
		keyLocation: INDEXNOW_KEY_LOCATION,
		urlList: [...new Set([...urls].filter(isDeploylintCanonicalUrl))]
	};
}
