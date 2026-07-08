import type { PaymentReadinessSummary, ScanCheck } from '$lib/scan/types';

function issueLine(check: ScanCheck): string {
	return `${check.title}: ${check.message}`;
}

function plural(count: number, singular: string, pluralWord = `${singular}s`): string {
	return `${count} ${count === 1 ? singular : pluralWord}`;
}

export function buildPaymentReadinessSummary(checks: ScanCheck[]): PaymentReadinessSummary {
	const paymentChecks = checks.filter((check) => check.category === 'payments');
	const pass = paymentChecks.filter((check) => check.status === 'pass').length;
	const warn = paymentChecks.filter((check) => check.status === 'warn').length;
	const fail = paymentChecks.filter((check) => check.status === 'fail').length;
	const blockers = paymentChecks.filter((check) => check.status === 'fail').map(issueLine);
	const warnings = paymentChecks.filter((check) => check.status === 'warn').map(issueLine);
	const checked = paymentChecks.map((check) => check.id);

	if (paymentChecks.length === 0) {
		return {
			status: 'not-detected',
			headline: 'No payment provider was detected in sampled site or repository surfaces.',
			pass,
			warn,
			fail,
			checked,
			blockers,
			warnings
		};
	}

	if (fail > 0) {
		return {
			status: 'blocked',
			headline: `Customer access readiness blocked by ${plural(fail, 'access blocker')}.`,
			pass,
			warn,
			fail,
			checked,
			blockers,
			warnings
		};
	}

	if (warn > 0) {
		return {
			status: 'needs-attention',
			headline: `Customer access readiness needs attention: ${plural(warn, 'warning')}.`,
			pass,
			warn,
			fail,
			checked,
			blockers,
			warnings
		};
	}

	return {
		status: 'ready',
		headline: `Customer access readiness looks clear across ${plural(pass, 'check')}.`,
		pass,
		warn,
		fail,
		checked,
		blockers,
		warnings
	};
}
