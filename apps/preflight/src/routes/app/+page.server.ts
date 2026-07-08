import { resolveAlphaFreeUnlock } from '$lib/product/alpha';
import {
	buildAdvisoryWorkflow,
	buildProjectDraftFromSearchParams,
	buildWorkspaceGatePolicy,
	buildWorkspaceActivation
} from '$lib/product/workspace';
import { buildLoginRedirect } from '$lib/server/auth-config';
import { loadOrCreateWorkspaceState } from '$lib/server/workspace-store';
import { redirect } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

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
	const projectDraftApplied = Object.keys(projectDraft).length > 0;

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
		projectDraftApplied,
		gatePolicy: project ? buildWorkspaceGatePolicy(project) : null,
		advisoryWorkflow: project
			? buildAdvisoryWorkflow({
					appUrl,
					projectId: project.id,
					deployUrl: project.deployUrl,
					minScore: project.minScore
				})
			: ''
	};
};
