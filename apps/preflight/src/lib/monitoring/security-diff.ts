import type { ScanCheck, ScanReport } from '$lib/scan/types';

export type SecurityIssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'unknown';

export interface SecurityIssueSnapshot {
	id: string;
	title: string;
	status: Exclude<ScanCheck['status'], 'pass'>;
	message: string;
	severity: SecurityIssueSeverity;
}

export interface SecuritySnapshot {
	url: string;
	finalUrl: string;
	scannedAt: string;
	issues: SecurityIssueSnapshot[];
}

export interface SecuritySnapshotDiff {
	shouldNotify: boolean;
	newIssues: SecurityIssueSnapshot[];
	worsenedIssues: SecurityIssueSnapshot[];
	resolvedIssues: SecurityIssueSnapshot[];
}

const MONITORED_SECURITY_IDS = new Set([
	'dependency-vulns',
	'exposed-env',
	'exposed-git',
	'exposed-backup',
	'exposed-package',
	'form-security',
	'hsts-header',
	'csp-header',
	'clickjack-header',
	'mime-sniff-header',
	'referrer-header',
	'permissions-policy-header',
	'sri',
	'noopener',
	'wp-exposure',
	'mailto-exposure'
]);

const STATUS_RANK: Record<SecurityIssueSnapshot['status'], number> = {
	warn: 1,
	fail: 2
};

const SEVERITY_RANK: Record<SecurityIssueSeverity, number> = {
	unknown: 0,
	low: 1,
	medium: 2,
	high: 3,
	critical: 4
};

export function snapshotSecurityIssues(report: ScanReport): SecuritySnapshot {
	return {
		url: report.url,
		finalUrl: report.finalUrl,
		scannedAt: report.scannedAt,
		issues: report.checks.filter(isAlertWorthySecurityIssue).map((check) => ({
			id: check.id,
			title: check.title,
			status: check.status,
			message: check.message,
			severity: severityFromMessage(check.message)
		}))
	};
}

export function diffSecuritySnapshots(
	previous: SecuritySnapshot,
	current: SecuritySnapshot
): SecuritySnapshotDiff {
	const previousById = new Map(previous.issues.map((issue) => [issue.id, issue]));
	const currentById = new Map(current.issues.map((issue) => [issue.id, issue]));

	const newIssues = current.issues.filter((issue) => !previousById.has(issue.id));
	const worsenedIssues = current.issues.filter((issue) => {
		const before = previousById.get(issue.id);

		return before ? isWorseIssue(before, issue) : false;
	});
	const resolvedIssues = previous.issues.filter((issue) => !currentById.has(issue.id));

	return {
		shouldNotify: newIssues.length > 0 || worsenedIssues.length > 0,
		newIssues,
		worsenedIssues,
		resolvedIssues
	};
}

function isAlertWorthySecurityIssue(
	check: ScanCheck
): check is ScanCheck & { status: SecurityIssueSnapshot['status'] } {
	return (
		check.category === 'security' && check.status !== 'pass' && MONITORED_SECURITY_IDS.has(check.id)
	);
}

function isWorseIssue(previous: SecurityIssueSnapshot, current: SecurityIssueSnapshot): boolean {
	return (
		STATUS_RANK[current.status] > STATUS_RANK[previous.status] ||
		SEVERITY_RANK[current.severity] > SEVERITY_RANK[previous.severity]
	);
}

function severityFromMessage(message: string): SecurityIssueSeverity {
	const normalized = message.toLowerCase();

	if (normalized.includes('critical')) return 'critical';
	if (normalized.includes('high')) return 'high';
	if (normalized.includes('medium') || normalized.includes('moderate')) return 'medium';
	if (normalized.includes('low')) return 'low';

	return 'unknown';
}
