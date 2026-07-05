import type { ScanCheck } from '$lib/scan/types';

export type RepoFindingEngine =
	| 'deploylint-static'
	| 'osv-api'
	| 'osv-scanner'
	| 'zizmor'
	| 'trivy'
	| 'semgrep'
	| 'scorecard'
	| 'sbom'
	| 'sarif-export';

export type RepoFindingConfidence = 'high' | 'medium' | 'low';
export type RepoFindingLaunchImpact = 'blocker' | 'fix-soon' | 'watch';

export interface RepoFindingEvidence {
	path?: string;
	snippet?: string;
}

export interface RepoFindingReference {
	label: string;
	url: string;
}

export interface RepoFinding {
	id: string;
	ruleId: string;
	category: ScanCheck['category'];
	title: string;
	status: ScanCheck['status'];
	message: string;
	engine: RepoFindingEngine;
	confidence: RepoFindingConfidence;
	launchImpact: RepoFindingLaunchImpact;
	evidence?: RepoFindingEvidence;
	references: RepoFindingReference[];
	fixPromptId: string;
	fingerprint: string;
}

export type RepoFindingInput = Omit<
	RepoFinding,
	'ruleId' | 'engine' | 'confidence' | 'launchImpact' | 'references' | 'fixPromptId' | 'fingerprint'
> &
	Partial<
		Pick<
			RepoFinding,
			| 'ruleId'
			| 'engine'
			| 'confidence'
			| 'launchImpact'
			| 'references'
			| 'fixPromptId'
			| 'fingerprint'
		>
	>;

const BLOCKER_RULE_IDS = new Set([
	'dependency-vulns',
	'docker-env-copy',
	'env-committed',
	'secrets',
	'webhook-signature-missing',
	'workflow-pull-request-target'
]);

const FIX_SOON_RULE_IDS = new Set([
	'billing-portal',
	'ci-runs-quality-gates',
	'dependency-review-action',
	'dependabot-config',
	'deploy-config',
	'gitignore-env',
	'health-endpoint',
	'security-policy',
	'webhook-signature-missing',
	'workflow-permissions'
]);

const STATUS_RANK: Record<ScanCheck['status'], number> = {
	pass: 0,
	warn: 1,
	fail: 2
};

const IMPACT_RANK: Record<RepoFindingLaunchImpact, number> = {
	watch: 0,
	'fix-soon': 1,
	blocker: 2
};

export function defaultLaunchImpact(
	input: Pick<RepoFindingInput, 'id' | 'status'>
): RepoFindingLaunchImpact {
	if (input.status === 'pass') return 'watch';
	if (input.status === 'fail' && BLOCKER_RULE_IDS.has(input.id)) return 'blocker';
	if (FIX_SOON_RULE_IDS.has(input.id)) return 'fix-soon';
	if (input.status === 'fail') return 'fix-soon';
	return 'watch';
}

export function normalizeRepoFinding(input: RepoFindingInput): RepoFinding {
	const ruleId = input.ruleId ?? input.id;
	const engine = input.engine ?? 'deploylint-static';
	const fixPromptId = input.fixPromptId ?? ruleId;

	return {
		...input,
		ruleId,
		engine,
		confidence: input.confidence ?? 'high',
		launchImpact: input.launchImpact ?? defaultLaunchImpact({ id: ruleId, status: input.status }),
		references: input.references ?? [],
		fixPromptId,
		fingerprint: input.fingerprint ?? `${engine}:${ruleId}`
	};
}

function compareRepoFindings(a: RepoFinding, b: RepoFinding): number {
	const statusDelta = STATUS_RANK[a.status] - STATUS_RANK[b.status];
	if (statusDelta !== 0) return statusDelta;
	return IMPACT_RANK[a.launchImpact] - IMPACT_RANK[b.launchImpact];
}

export function mergeRepoFindings(findings: RepoFinding[]): RepoFinding[] {
	const merged = new Map<string, RepoFinding>();
	for (const finding of findings) {
		const existing = merged.get(finding.id);
		if (!existing || compareRepoFindings(finding, existing) >= 0) {
			merged.set(finding.id, finding);
		}
	}
	return [...merged.values()];
}
