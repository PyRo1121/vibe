import { describe, expect, it } from 'vitest';
import { diffSecuritySnapshots, snapshotSecurityIssues } from './security-diff';
import type { ScanCheck, ScanReport } from '$lib/scan/types';

function check(id: string, status: ScanCheck['status'], message = `${id} message`): ScanCheck {
	return {
		id,
		category: 'security',
		title: id,
		status,
		message,
		fixPrompt: `${id} fix`
	};
}

function report(checks: ScanCheck[]): ScanReport {
	return {
		url: 'https://app.test',
		finalUrl: 'https://app.test/',
		scannedAt: '2026-07-05T00:00:00.000Z',
		score: 82,
		verdict: 'conditional',
		verdictMessage: 'Fix important issues before launch.',
		checks,
		summary: {
			pass: checks.filter((c) => c.status === 'pass').length,
			warn: checks.filter((c) => c.status === 'warn').length,
			fail: checks.filter((c) => c.status === 'fail').length
		}
	};
}

describe('security monitoring diff', () => {
	it('snapshots only alert-worthy security issues', () => {
		const snapshot = snapshotSecurityIssues(
			report([
				check('dependency-vulns', 'fail', '1 vulnerable package (worst: high)'),
				check('description', 'warn', 'Missing meta description'),
				check('https', 'pass', 'HTTPS enabled')
			])
		);

		expect(snapshot.issues).toEqual([
			{
				id: 'dependency-vulns',
				title: 'dependency-vulns',
				status: 'fail',
				message: '1 vulnerable package (worst: high)',
				severity: 'high'
			}
		]);
	});

	it('alerts when a new CVE/security issue appears', () => {
		const previous = snapshotSecurityIssues(report([check('dependency-vulns', 'pass')]));
		const current = snapshotSecurityIssues(
			report([check('dependency-vulns', 'fail', 'CVE found (worst: critical)')])
		);

		const diff = diffSecuritySnapshots(previous, current);

		expect(diff.shouldNotify).toBe(true);
		expect(diff.newIssues.map((issue) => issue.id)).toEqual(['dependency-vulns']);
		expect(diff.worsenedIssues).toEqual([]);
	});

	it('alerts when an existing issue worsens from warn to fail', () => {
		const previous = snapshotSecurityIssues(
			report([check('dependency-vulns', 'warn', 'severity unavailable')])
		);
		const current = snapshotSecurityIssues(
			report([check('dependency-vulns', 'fail', 'worst: high')])
		);

		const diff = diffSecuritySnapshots(previous, current);

		expect(diff.shouldNotify).toBe(true);
		expect(diff.newIssues).toEqual([]);
		expect(diff.worsenedIssues.map((issue) => issue.id)).toEqual(['dependency-vulns']);
	});

	it('tracks resolved security issues without notifying', () => {
		const previous = snapshotSecurityIssues(report([check('exposed-env', 'fail')]));
		const current = snapshotSecurityIssues(report([check('exposed-env', 'pass')]));

		const diff = diffSecuritySnapshots(previous, current);

		expect(diff.shouldNotify).toBe(false);
		expect(diff.resolvedIssues.map((issue) => issue.id)).toEqual(['exposed-env']);
	});
});
