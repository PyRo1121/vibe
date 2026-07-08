import { resolveAlphaFreeUnlock } from '$lib/product/alpha';
import {
	buildAdvisoryWorkflow,
	buildProjectDraftFromSearchParams,
	buildWorkspaceGatePolicy,
	buildWorkspaceActivation,
	type DeploylintProject,
	type ProjectDraft
} from '$lib/product/workspace';
import { buildLoginRedirect } from '$lib/server/auth-config';
import { loadOrCreateWorkspaceState, promoteProjectToGate } from '$lib/server/workspace-store';
import { fail, redirect } from '@sveltejs/kit';

import type { Actions, PageServerLoad } from './$types';

type CheckoutReturnStatus = 'cancel' | 'success';

function checkoutReturnStatus(value: string | null): CheckoutReturnStatus | null {
	if (value === 'success' || value === 'cancel') return value;
	return null;
}

function projectReflectsDraft(
	project: DeploylintProject | undefined,
	projectDraft: ProjectDraft
): boolean {
	if (!project) return false;
	return (
		Object.keys(projectDraft).length > 0 &&
		(projectDraft.name === undefined || project.name === projectDraft.name) &&
		(projectDraft.repoLabel === undefined || project.repoLabel === projectDraft.repoLabel) &&
		(projectDraft.deployUrl === undefined || project.deployUrl === projectDraft.deployUrl) &&
		(projectDraft.minScore === undefined || project.minScore === projectDraft.minScore)
	);
}

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	if (!locals.user) {
		redirect(303, buildLoginRedirect(url));
	}

	const env = platform?.env;
	const appUrl = env?.PUBLIC_APP_URL?.trim() || url.origin;
	const alphaFreeUnlock = resolveAlphaFreeUnlock(env);
	const ownerName = locals.user.name?.trim() || locals.user.email;
	const projectDraft = buildProjectDraftFromSearchParams(url.searchParams);
	const workspace = await loadOrCreateWorkspaceState(env?.AUTH_DB, {
		alphaFreeUnlock,
		ownerLabel: `${ownerName}'s workspace`,
		ownerUserId: locals.user.id,
		projectDraft
	});
	const project = workspace.projects[0];
	const activation = buildWorkspaceActivation(workspace);
	const projectDraftApplied = projectReflectsDraft(project, projectDraft);

	return {
		appUrl: appUrl.replace(/\/$/, ''),
		user: {
			id: locals.user.id,
			name: locals.user.name,
			email: locals.user.email,
			image: locals.user.image
		},
		workspace,
		activation,
		checkoutStatus: checkoutReturnStatus(url.searchParams.get('checkout')),
		projectDraftApplied,
		gatePolicy: project ? buildWorkspaceGatePolicy(project) : null,
		advisoryWorkflow: project
			? buildAdvisoryWorkflow({
					appUrl,
					projectId: project.id,
					deployUrl: project.deployUrl,
					mode: project.gateMode,
					minScore: project.minScore
				})
			: ''
	};
};

function gatePromotionMessage(
	reason: Exclude<Awaited<ReturnType<typeof promoteProjectToGate>>, { ok: true }>['reason']
): string {
	if (reason === 'missing-db') return 'Workspace storage is not available in this environment.';
	if (reason === 'invalid-project') return 'Select a valid project before enabling gate mode.';
	if (reason === 'not-found') return 'This project was not found in your workspace.';
	if (reason === 'not-ready') {
		return 'Run a clean advisory report that meets the minimum score before enabling gate mode.';
	}
	return 'Gate mode could not be enabled right now. Try again after refreshing the workspace.';
}

export const actions: Actions = {
	enableGate: async ({ locals, platform, request, url }) => {
		if (!locals.user) {
			redirect(303, buildLoginRedirect(url));
		}

		const form = await request.formData();
		const result = await promoteProjectToGate(
			platform?.env?.AUTH_DB,
			locals.user.id,
			form.get('projectId')
		);

		if (!result.ok) {
			return fail(400, {
				enableGateError: gatePromotionMessage(result.reason)
			});
		}

		return { gateEnabled: true };
	}
};
