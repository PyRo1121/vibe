#!/usr/bin/env node
/**
 * Apply Cloudflare zone firewall + security settings for deploylint.com.
 *
 * Requires an API token with Zone Settings Edit + Zone WAF Edit (wrangler OAuth is read-only).
 *
 *   CLOUDFLARE_API_TOKEN=... node scripts/setup-cloudflare-firewall.mjs
 *   # or: npm run setup:cloudflare-firewall -w preflight
 *
 * @see docs/superpowers/workflow/cloudflare-firewall.md
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const ZONE_NAME = process.env.CLOUDFLARE_ZONE ?? 'deploylint.com';
const API = 'https://api.cloudflare.com/client/v4';

const ZONE_SETTINGS = [
	{ id: 'security_level', value: 'medium' },
	{ id: 'browser_check', value: 'on' },
	{ id: 'always_use_https', value: 'on' },
	{ id: 'min_tls_version', value: '1.2' },
	{ id: 'tls_1_3', value: 'on' },
	{ id: 'automatic_https_rewrites', value: 'on' },
	{ id: 'opportunistic_encryption', value: 'on' },
	{ id: 'privacy_pass', value: 'on' },
	{ id: 'ssl', value: 'full' }
];

/** Max 5 custom WAF rules on Free — tagged with deploylint: prefix for idempotent updates. */
const WAF_RULES = [
	{
		description: 'deploylint:block-exploit-probes',
		expression: `(http.request.uri.path contains "/.env" or http.request.uri.path contains "/.git" or http.request.uri.path contains "/wp-" or http.request.uri.path contains "xmlrpc.php" or http.request.uri.path contains "/phpmyadmin" or http.request.uri.path contains "/cgi-bin/")`,
		action: 'block'
	},
	{
		description: 'deploylint:block-dangerous-methods',
		expression: '(http.request.method in {"TRACE" "TRACK" "CONNECT"})',
		action: 'block'
	},
	{
		description: 'deploylint:block-path-traversal-query',
		expression:
			'(http.request.uri.query contains "%2e%2e" or http.request.uri.query contains "..")',
		action: 'block'
	},
	{
		description: 'deploylint:block-empty-ua-api-post',
		expression:
			'(http.request.method eq "POST" and starts_with(http.request.uri.path, "/api/") and http.request.uri.path ne "/api/webhooks/stripe" and len(http.user_agent) eq 0)',
		action: 'block'
	},
	{
		description: 'deploylint:block-scanner-user-agents',
		expression:
			'(http.user_agent contains "sqlmap" or http.user_agent contains "nikto" or http.user_agent contains "masscan" or http.user_agent contains "zgrab" or http.user_agent contains "dirbuster")',
		action: 'block'
	}
];

function loadToken() {
	if (process.env.CLOUDFLARE_API_TOKEN?.trim()) return process.env.CLOUDFLARE_API_TOKEN.trim();
	const configPath = join(
		homedir(),
		'AppData',
		'Roaming',
		'xdg.config',
		'.wrangler',
		'config',
		'default.toml'
	);
	try {
		const raw = readFileSync(configPath, 'utf8');
		const match = raw.match(/oauth_token\s*=\s*"([^"]+)"/);
		if (match) {
			console.warn(
				'Using wrangler OAuth token — zone firewall writes usually need CLOUDFLARE_API_TOKEN.'
			);
			return match[1];
		}
	} catch {
		/* no wrangler config */
	}
	return null;
}

async function cf(method, path, token, body) {
	const res = await fetch(`${API}${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: body ? JSON.stringify(body) : undefined
	});
	const json = await res.json();
	if (!json.success) {
		const msg = json.errors?.map((e) => e.message).join('; ') ?? res.statusText;
		const err = new Error(`${method} ${path} failed: ${msg}`);
		err.status = res.status;
		err.payload = json;
		throw err;
	}
	return json.result;
}

async function main() {
	const token = loadToken();
	if (!token) {
		console.error('Set CLOUDFLARE_API_TOKEN (Zone Settings Edit + Zone WAF Edit).');
		console.error('Create at: https://dash.cloudflare.com/profile/api-tokens');
		process.exit(1);
	}

	const zones = await cf('GET', `/zones?name=${ZONE_NAME}`, token);
	const zone = zones?.[0];
	if (!zone) {
		console.error(`Zone not found: ${ZONE_NAME}`);
		process.exit(1);
	}
	const zoneId = zone.id;
	console.log(`Zone: ${zone.name} (${zoneId}) — plan: ${zone.plan?.name ?? 'unknown'}`);

	for (const setting of ZONE_SETTINGS) {
		try {
			await cf('PATCH', `/zones/${zoneId}/settings/${setting.id}`, token, { value: setting.value });
			console.log(`✓ setting ${setting.id} = ${setting.value}`);
		} catch (err) {
			console.error(`✗ setting ${setting.id}: ${err.message}`);
		}
	}

	try {
		await cf('PUT', `/zones/${zoneId}/bot_management`, token, { fight_mode: true });
		console.log('✓ bot_fight_mode = on');
	} catch (err) {
		console.warn(`- bot_fight_mode skipped: ${err.message}`);
	}

	const phase = 'http_request_firewall_custom';
	let entry;
	try {
		entry = await cf('GET', `/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`, token);
	} catch (err) {
		console.error(`✗ WAF entrypoint: ${err.message}`);
		process.exit(1);
	}

	const existing = entry?.rules ?? [];
	const foreign = existing.filter((r) => !String(r.description ?? '').startsWith('deploylint:'));
	const merged = [...foreign, ...WAF_RULES.map((rule) => ({ ...rule, enabled: true }))].slice(0, 5);

	await cf('PUT', `/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`, token, { rules: merged });
	console.log(
		`✓ WAF custom rules: ${WAF_RULES.length} deploylint rules active (${merged.length}/5 total)`
	);

	console.log('\nDone. DDoS L3/L4 protection is automatic on all Cloudflare plans.');
	console.log(
		'Worker edge limits: hooks.server.ts + usage-budget.ts (already deployed with the app).'
	);
}

main().catch((err) => {
	if (err.status === 403 || String(err.message).includes('9109')) {
		console.error('\nUnauthorized — wrangler OAuth cannot edit zone firewall.');
		console.error('Create a dedicated API token:');
		console.error('  1. https://dash.cloudflare.com/profile/api-tokens → Create Token');
		console.error(
			'  2. Permissions: Zone · Zone Settings · Edit, Zone · Firewall Services · Edit, Zone · Zone · Read'
		);
		console.error('  3. Zone Resources: Include · Specific zone · deploylint.com');
		console.error('  4. CLOUDFLARE_API_TOKEN=... npm run setup:cloudflare-firewall -w preflight');
	}
	console.error(err.message ?? err);
	process.exit(1);
});
