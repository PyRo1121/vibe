import type { ScanReport } from '$lib/scan/types';

export type CiAdoptionStepStatus = 'complete' | 'current' | 'queued';

export interface CiAdoptionStep {
	id: 'decision' | 'advisory' | 'required-check' | 'gate-mode';
	label: string;
	description: string;
	status: CiAdoptionStepStatus;
}

export interface CiAdoptionState {
	summary: string;
	nextAction: string;
	steps: CiAdoptionStep[];
}

function isGateReady(report: ScanReport): boolean {
	return report.verdict === 'go' && report.score >= 80 && report.summary.fail === 0;
}

function hasRepeatEvidence(report: ScanReport): boolean {
	return Boolean(report.history?.length || report.scanDiff);
}

function currentStepId(
	report: ScanReport
): Extract<CiAdoptionStep['id'], 'advisory' | 'required-check' | 'gate-mode'> {
	if (!report.repo) return 'advisory';
	if (!hasRepeatEvidence(report)) return 'advisory';
	if (!isGateReady(report)) return 'required-check';
	return 'gate-mode';
}

function stepStatus(
	stepId: CiAdoptionStep['id'],
	current: CiAdoptionStep['id']
): CiAdoptionStepStatus {
	if (stepId === 'decision') return 'complete';
	if (stepId === current) return 'current';
	if (stepId === 'advisory' && current !== 'advisory') return 'complete';
	if (stepId === 'required-check' && current === 'gate-mode') return 'complete';
	return 'queued';
}

function adoptionSummary(report: ScanReport): string {
	if (!report.repo) {
		return 'Attach the repository and install the advisory workflow so this decision repeats on every pull request.';
	}
	if (!hasRepeatEvidence(report)) {
		return 'Use this repo-backed decision as the first advisory PR report before the team trusts a blocking check.';
	}
	if (!isGateReady(report)) {
		return 'Keep Deploylint advisory while blockers remain, then make the required check enforce the cleaned-up signal.';
	}
	return 'The signal is clean enough to prepare a required status check and switch the workflow to gate mode.';
}

function nextAction(report: ScanReport): string {
	if (!report.repo) return 'Create the workspace project and connect the GitHub repository.';
	if (!hasRepeatEvidence(report)) return 'Copy the advisory workflow into GitHub Actions.';
	if (!isGateReady(report))
		return 'Fix the remaining blockers before branch protection depends on this check.';
	return 'Make deploylint a required check, then set DEPLOYLINT_MODE to gate.';
}

export function buildCiAdoptionState(report: ScanReport): CiAdoptionState {
	const current = currentStepId(report);
	const steps: CiAdoptionStep[] = [
		{
			id: 'decision',
			label: 'Deploy gate decision',
			description: `${report.score}/100 with ${report.summary.fail} failing check${report.summary.fail === 1 ? '' : 's'}.`,
			status: 'complete'
		},
		{
			id: 'advisory',
			label: 'Advisory PR report',
			description: 'Run non-blocking in CI so findings show up on every risky change.',
			status: stepStatus('advisory', current)
		},
		{
			id: 'required-check',
			label: 'Required status check',
			description: 'Add branch protection after the report is useful and low-noise.',
			status: stepStatus('required-check', current)
		},
		{
			id: 'gate-mode',
			label: 'Gate mode',
			description: 'Fail deploys below the score threshold or with P0 blockers.',
			status: stepStatus('gate-mode', current)
		}
	];

	return {
		summary: adoptionSummary(report),
		nextAction: nextAction(report),
		steps
	};
}
