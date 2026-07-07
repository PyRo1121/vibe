import { resolveAlphaFreeUnlock } from '$lib/product/alpha';
import {
	buildAdvisoryWorkflow,
	buildDemoWorkspace,
	buildWorkspaceGatePolicy,
	buildWorkspaceActivation
} from '$lib/product/workspace';
import { buildLoginRedirect } from '$lib/server/auth-config';
import { redirect } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, platform, url }) => {
	if (!locals.user) {
		redirect(303, buildLoginRedirect(url));
	}

	const env = platform?.env;
	const appUrl = env?.PUBLIC_APP_URL?.trim() || url.origin;
	const alphaFreeUnlock = resolveAlphaFreeUnlock(env);
	const ownerName = locals.user.name?.trim() || locals.user.email;
	const workspace = buildDemoWorkspace({
		appUrl,
		alphaFreeUnlock,
		ownerLabel: `${ownerName}'s workspace`
	});
	const project = workspace.projects[0];
	const activation = buildWorkspaceActivation(workspace);

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
