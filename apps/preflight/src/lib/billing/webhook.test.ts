import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
	isCheckoutSessionFulfilled,
	parseStripeWebhookEvent,
	verifyStripeWebhookSignature
} from './webhook';

function signPayload(payload: string, secret: string, timestamp?: string): string {
	const ts = timestamp ?? String(Math.floor(Date.now() / 1000));
	const signed = `${ts}.${payload}`;
	const v1 = createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
	return `t=${ts},v1=${v1}`;
}

describe('verifyStripeWebhookSignature', () => {
	it('accepts valid signatures (hex-decoded compare per Stripe docs)', () => {
		const payload = '{"type":"checkout.session.completed"}';
		const secret = 'whsec_test';
		const header = signPayload(payload, secret);
		expect(verifyStripeWebhookSignature(payload, header, secret)).toBe(true);
	});

	it('rejects tampered payloads', () => {
		const payload = '{"type":"checkout.session.completed"}';
		const secret = 'whsec_test';
		const header = signPayload('{"type":"bad"}', secret);
		expect(verifyStripeWebhookSignature(payload, header, secret)).toBe(false);
	});

	it('rejects stale timestamps', () => {
		const payload = '{"type":"checkout.session.completed"}';
		const secret = 'whsec_test';
		const stale = String(Math.floor(Date.now() / 1000) - 600);
		const header = signPayload(payload, secret, stale);
		expect(verifyStripeWebhookSignature(payload, header, secret)).toBe(false);
	});

	it('accepts any valid v1 when Stripe sends multiple signatures', () => {
		const payload = '{"type":"checkout.session.completed"}';
		const secret = 'whsec_test';
		const valid = signPayload(payload, secret);
		const invalid = signPayload('{"type":"bad"}', secret);
		const validSig = valid.split('v1=')[1];
		const invalidSig = invalid.split('v1=')[1];
		const header = `t=${Math.floor(Date.now() / 1000)},v1=${invalidSig},v1=${validSig}`;
		expect(verifyStripeWebhookSignature(payload, header, secret)).toBe(true);
	});

	it('rejects missing, malformed, or non-numeric signature headers', () => {
		const payload = '{"type":"checkout.session.completed"}';
		const secret = 'whsec_test';

		expect(verifyStripeWebhookSignature(payload, null, secret)).toBe(false);
		expect(verifyStripeWebhookSignature(payload, 'bad-header', secret)).toBe(false);
		expect(verifyStripeWebhookSignature(payload, 't=now,v1=abc', secret)).toBe(false);
	});

	it('skips invalid hex signatures and keeps checking later signatures', () => {
		const payload = '{"type":"checkout.session.completed"}';
		const secret = 'whsec_test';
		const valid = signPayload(payload, secret);
		const validSig = valid.split('v1=')[1];
		const header = `t=${Math.floor(Date.now() / 1000)},v1=not-hex,v1=abc,v1=${validSig}`;

		expect(verifyStripeWebhookSignature(payload, header, secret)).toBe(true);
	});
});

describe('isCheckoutSessionFulfilled', () => {
	it('detects paid checkout completion', () => {
		const event = parseStripeWebhookEvent(
			JSON.stringify({
				type: 'checkout.session.completed',
				data: { object: { payment_status: 'paid', status: 'complete', id: 'cs_test_1' } }
			})
		);
		expect(isCheckoutSessionFulfilled(event)).toBe(true);
	});

	it('ignores completed sessions that are not yet paid (async methods)', () => {
		const event = parseStripeWebhookEvent(
			JSON.stringify({
				type: 'checkout.session.completed',
				data: { object: { payment_status: 'unpaid', status: 'complete', id: 'cs_test_1' } }
			})
		);
		expect(isCheckoutSessionFulfilled(event)).toBe(false);
	});

	it('accepts async_payment_succeeded', () => {
		const event = parseStripeWebhookEvent(
			JSON.stringify({
				type: 'checkout.session.async_payment_succeeded',
				data: { object: { id: 'cs_test_1' } }
			})
		);
		expect(isCheckoutSessionFulfilled(event)).toBe(true);
	});

	it('does not fulfill failed async payments or subscription lifecycle events', () => {
		const failed = parseStripeWebhookEvent(
			JSON.stringify({
				type: 'checkout.session.async_payment_failed',
				data: { object: { id: 'cs_test_1' } }
			})
		);
		const deleted = parseStripeWebhookEvent(
			JSON.stringify({
				type: 'customer.subscription.deleted',
				data: { object: { subscription: 'sub_1' } }
			})
		);

		expect(isCheckoutSessionFulfilled(failed)).toBe(false);
		expect(isCheckoutSessionFulfilled(deleted)).toBe(false);
	});
});
