#!/usr/bin/env node
/**
 * Deploylint live Stripe store setup. Requires a full sk_live_ secret key.
 * Stripe CLI live mode uses restricted rk_live keys and cannot create Products,
 * Prices, or Webhook Endpoints.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/setup-deploylint-store-live.mjs
 *   node scripts/setup-deploylint-store-live.mjs --api-key-file .stripe-live.key
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const currentDir = import.meta.dirname;
const WEBHOOK_URL = 'https://deploylint.com/api/webhooks/stripe';
const CURRENCY = 'usd';
const TAX_CODE = 'txcd_10701401';

const PLANS = [
	{
		id: 'solo',
		name: 'Deploylint Solo',
		envVar: 'STRIPE_PRICE_SOLO',
		lookupKey: 'deploylint_solo_monthly',
		unitAmount: 900,
		description:
			'One monitored AI-built app with fix prompts, MCP scan access, deploy gate, and weekly launch monitoring.'
	},
	{
		id: 'builder',
		name: 'Deploylint Builder',
		envVar: 'STRIPE_PRICE_BUILDER',
		lookupKey: 'deploylint_builder_monthly',
		unitAmount: 2900,
		description:
			'Five monitored AI-built apps with daily monitoring, saved history, re-scan deltas, and launch regression alerts.'
	},
	{
		id: 'agency',
		name: 'Deploylint Agency',
		envVar: 'STRIPE_PRICE_AGENCY',
		lookupKey: 'deploylint_agency_monthly',
		unitAmount: 14900,
		description:
			'Twenty-five monitored AI-built apps with client-ready reports, exports, and webhook-ready alert workflows.'
	}
];

function parseArgs() {
	const fileIdx = process.argv.indexOf('--api-key-file');
	if (fileIdx !== -1 && process.argv[fileIdx + 1]) {
		return readFileSync(resolve(currentDir, '..', process.argv[fileIdx + 1]), 'utf8').trim();
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

function dollars(unitAmount) {
	return `$${(unitAmount / 100).toFixed(0)}/mo`;
}

async function ensureWebhook(secretKey) {
	const list = await stripe(secretKey, '/webhook_endpoints?limit=20');
	const existing = list.data?.find((w) => w.url === WEBHOOK_URL && w.status === 'enabled');
	const webhookParams = {
		url: WEBHOOK_URL,
		description: 'Deploylint production (live)',
		'enabled_events[0]': 'checkout.session.completed',
		'enabled_events[1]': 'checkout.session.async_payment_succeeded'
	};

	if (existing) {
		console.log(`ok Live webhook exists: ${existing.id}`);
		if (existing.description !== webhookParams.description) {
			await stripe(
				secretKey,
				`/webhook_endpoints/${existing.id}`,
				'POST',
				form({ description: webhookParams.description })
			);
			console.log('ok Webhook description updated');
		}
		return existing;
	}

	const created = await stripe(secretKey, '/webhook_endpoints', 'POST', form(webhookParams));
	console.log(`ok Live webhook created: ${created.id}`);
	console.log('\nWebhook signing secret. Set it on the Worker:');
	console.log(created.secret);
	console.log('\n  npx wrangler secret put STRIPE_WEBHOOK_SECRET');
	return created;
}

async function ensureProduct(secretKey, plan) {
	const list = await stripe(secretKey, '/products?limit=100&active=true');
	const existing = list.data?.find(
		(product) => product.metadata?.app === 'deploylint' && product.metadata?.plan === plan.id
	);

	if (existing) {
		const updates = {};
		if (existing.name !== plan.name) updates.name = plan.name;
		if (existing.description !== plan.description) updates.description = plan.description;
		if (existing.tax_code !== TAX_CODE) updates.tax_code = TAX_CODE;
		if (Object.keys(updates).length > 0) {
			await stripe(secretKey, `/products/${existing.id}`, 'POST', form(updates));
			console.log(`ok Product updated: ${plan.name} (${existing.id})`);
		} else {
			console.log(`ok Product exists: ${plan.name} (${existing.id})`);
		}
		return existing;
	}

	const created = await stripe(
		secretKey,
		'/products',
		'POST',
		form({
			name: plan.name,
			description: plan.description,
			tax_code: TAX_CODE,
			'metadata[app]': 'deploylint',
			'metadata[plan]': plan.id
		})
	);
	console.log(`ok Product created: ${plan.name} (${created.id})`);
	return created;
}

async function ensureMonthlyPrice(secretKey, plan, product) {
	const prices = await stripe(secretKey, `/prices?product=${product.id}&active=true&limit=100`);
	const existing = prices.data?.find((price) => price.lookup_key === plan.lookupKey);
	if (existing) {
		console.log(
			`ok Monthly price exists: ${plan.name} ${dollars(plan.unitAmount)} (${existing.id})`
		);
		return existing;
	}

	const created = await stripe(
		secretKey,
		'/prices',
		'POST',
		form({
			product: product.id,
			unit_amount: String(plan.unitAmount),
			currency: CURRENCY,
			lookup_key: plan.lookupKey,
			'recurring[interval]': 'month',
			'metadata[app]': 'deploylint',
			'metadata[plan]': plan.id
		})
	);
	await stripe(secretKey, `/products/${product.id}`, 'POST', form({ default_price: created.id }));
	console.log(`ok Monthly price created: ${plan.name} ${dollars(plan.unitAmount)} (${created.id})`);
	return created;
}

function verifyWorkerSecrets() {
	try {
		const raw = execSync('npx wrangler secret list', {
			cwd: resolve(currentDir, '..'),
			encoding: 'utf8',
			stdio: 'pipe'
		});
		const listed = JSON.parse(raw);
		const names = listed.map((secret) => secret.name);
		if (names.includes('STRIPE_SECRET_KEY') && names.includes('STRIPE_WEBHOOK_SECRET')) {
			console.log('\nok Worker secrets STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are present');
		} else {
			console.log('\nMissing Worker secrets:', names.join(', ') || '(none)');
			console.log('  npx wrangler secret put STRIPE_SECRET_KEY');
			console.log('  npx wrangler secret put STRIPE_WEBHOOK_SECRET');
		}
	} catch {
		console.log('\nCould not verify wrangler secrets');
	}
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

	console.log('Deploylint live subscription store setup\n');
	await ensureWebhook(secretKey);

	const envLines = [];
	for (const plan of PLANS) {
		const product = await ensureProduct(secretKey, plan);
		const price = await ensureMonthlyPrice(secretKey, plan, product);
		envLines.push(`${plan.envVar}=${price.id}`);
	}

	verifyWorkerSecrets();

	console.log('\nConfigure these Worker vars in wrangler.jsonc or Cloudflare dashboard:');
	for (const line of envLines) console.log(`  ${line}`);
	console.log('\nDone. Run: npm run verify');
}

main().catch((err) => {
	console.error(err.message ?? err);
	process.exit(1);
});
