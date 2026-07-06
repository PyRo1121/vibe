/**
 * @param {string} value
 */
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} html
 * @param {string} host
 */
export function hasPlausibleHtmlSnippet(html, host) {
	const escapedHost = escapeRegExp(host);
	const hasHost =
		new RegExp(`name=["']plausible-domain["'][^>]*content=["']${escapedHost}["']`, 'i').test(
			html
		) ||
		new RegExp(`content=["']${escapedHost}["'][^>]*name=["']plausible-domain["']`, 'i').test(html);
	const hasInit = html.includes('plausible.init');
	const hasPersonalizedScript =
		/<script\b[^>]*\bsrc=["']https:\/\/plausible\.io\/js\/pa-[^"']+\.js["'][^>]*>/i.test(html);
	const hasProxyScript = /<script\b[^>]*\bsrc=["']\/s\/script\.js["'][^>]*>/i.test(html);

	return hasHost && hasInit && (hasPersonalizedScript || hasProxyScript);
}
