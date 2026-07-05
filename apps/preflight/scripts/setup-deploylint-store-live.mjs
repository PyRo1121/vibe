#!/usr/bin/env node
/**
 * Deploylint live Stripe store setup — requires full secret key (sk_live_…).
 * CLI live mode uses restricted keys (rk_live) and cannot create products/webhooks.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_… node scripts/setup-deploylint-store-live.mjs
 *   node scripts/setup-deploylint-store-live.mjs --api-key-file .stripe-live.key
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEBHOOK_URL = 'https://deploylint.com/api/webhooks/stripe';
const PRODUCT_NAME = 'Deploylint fix & verify';
const PRODUCT_DESC = 'All AI fix prompts, master repair prompt, and unlimited re-scans for one URL';
const UNIT_AMOUNT = 900;
const CURRENCY = 'usd';

function parseArgs() {
	const fileIdx = process.argv.indexOf('--api-key-file');
	if (fileIdx !== -1 && process.argv[fileIdx + 1]) {
		return readFileSync(resolve(__dirname, '..', process.argv[fileIdx + 1]), 'utf8').trim();
	}
	return process.env.STRIPE_SECRET_KEY?.trim() ?? '';
}

async function stripe(secretKey, path, method = 'GET', body) {
	const init = {
		method,
		headers: {
			Authorization: `Bearer ${secretKey}`,
			'Content-Type': 'application/x-www-form-urlencoded'
		}
	};
	if (body != null) init.body = body;
	const res = await fetch(`https://api.stripe.com/v1${path}`, init);
	const text = await res.text();
	let json;
	try {
		json = JSON.parse(text);
	} catch {
		throw new Error(`Stripe ${path}: ${text.slice(0, 200)}`);
	}
	if (!res.ok) {
		throw new Error(json.error?.message ?? text.slice(0, 200));
	}
	return json;
}

function form(entries) {
	return new URLSearchParams(entries);
}

async function ensureWebhook(secretKey) {
	const list = await stripe(secretKey, '/webhook_endpoints?limit=20');
	const existing = list.data?.find((w) => w.url === WEBHOOK_URL && w.status === 'enabled');
	if (existing) {
		console.log(`✓ Live webhook exists — ${existing.id}`);
		if (existing.description !== 'Deploylint production (live)') {
			await stripe(
				secretKey,
				`/webhook_endpoints/${existing.id}`,
				'POST',
				form({ description: 'Deploylint production (live)' })
			);
			console.log('✓ Webhook description updated');
		}
		return existing;
	}

	const created = await stripe(
		secretKey,
		'/webhook_endpoints',
		'POST',
		form({
			url: WEBHOOK_URL,
			description: 'Deploylint production (live)',
			'enabled_events[0]': 'checkout.session.completed',
			'enabled_events[1]': 'checkout.session.async_payment_succeeded'
		})
	);
	console.log(`✓ Live webhook created — ${created.id}`);
	console.log(`\nWebhook signing secret (set on Worker):`);
	console.log(created.secret);
	console.log(`\n  npx wrangler secret put STRIPE_WEBHOOK_SECRET`);
	return created;
}

async function ensureProduct(secretKey) {
	const list = await stripe(secretKey, '/products?limit=100&active=true');
	const existing = list.data?.find(
		(p) => p.name === PRODUCT_NAME && p.metadata?.app === 'deploylint'
	);
	if (existing) {
		console.log(`✓ Live product exists — ${existing.id}`);
		if (existing.default_price) return existing;
		const price = await stripe(
			secretKey,
			'/prices',
			'POST',
			form({
				product: existing.id,
				unit_amount: String(UNIT_AMOUNT),
				currency: CURRENCY
			})
		);
		console.log(`✓ Live price created — ${price.id} ($${UNIT_AMOUNT / 100})`);
		return existing;
	}

	const product = await stripe(
		secretKey,
		'/products',
		'POST',
		form({
			name: PRODUCT_NAME,
			description: PRODUCT_DESC,
			'metadata[app]': 'deploylint'
		})
	);
	const price = await stripe(
		secretKey,
		'/prices',
		'POST',
		form({
			product: product.id,
			unit_amount: String(UNIT_AMOUNT),
			currency: CURRENCY
		})
	);
	await stripe(secretKey, `/products/${product.id}`, 'POST', form({ default_price: price.id }));
	console.log(`✓ Live product created — ${product.id}`);
	console.log(`✓ Live price created — ${price.id} ($${UNIT_AMOUNT / 100})`);
	return product;
}

async function main() {
	const secretKey = parseArgs();
	if (!secretKey.startsWith('sk_live_')) {
		console.error(
			'Need sk_live_ secret key. Stripe CLI live mode uses restricted rk_live keys.\n' +
				'Set STRIPE_SECRET_KEY or pass --api-key-file .stripe-live.key (gitignored).'
		);
		process.exit(1);
	}

	console.log('Deploylint live store setup (acct via API)…\n');
	await ensureWebhook(secretKey);
	await ensureProduct(secretKey);

	try {
		execSync('npx wrangler secret list', { cwd: resolve(__dirname, '..'), stdio: 'pipe' });
		const listed = JSON.parse(
			execSync('npx wrangler secret list', { cwd: resolve(__dirname, '..'), encoding: 'utf8' })
		);
		const names = listed.map((s) => s.name);
		if (names.includes('STRIPE_SECRET_KEY') && names.includes('STRIPE_WEBHOOK_SECRET')) {
			console.log('\n✓ Worker secrets STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET present');
		} else {
			console.log('\n⚠ Missing Worker secrets:', names.join(', ') || '(none)');
		}
	} catch {
		console.log('\n⚠ Could not verify wrangler secrets');
	}

	console.log('\nDone. Run: npm run smoke:phase24');
}

main().catch((err) => {
	console.error(err.message ?? err);
	process.exit(1);
});
