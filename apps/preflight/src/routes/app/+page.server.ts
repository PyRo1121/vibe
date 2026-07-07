import { resolveAlphaFreeUnlock } from '$lib/product/alpha';
import { buildAdvisoryWorkflow, buildDemoWorkspace } from '$lib/product/workspace';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ platform, url }) => {
	const env = platform?.env;
	const appUrl = env?.PUBLIC_APP_URL?.trim() || url.origin;
	const alphaFreeUnlock = resolveAlphaFreeUnlock(env);
	const workspace = buildDemoWorkspace({ appUrl, alphaFreeUnlock });
	const project = workspace.projects[0];

	return {
		appUrl: appUrl.replace(/\/$/, ''),
		workspace,
		advisoryWorkflow: buildAdvisoryWorkflow({
			appUrl,
			projectId: project.id,
			deployUrl: project.deployUrl
		})
	};
};
