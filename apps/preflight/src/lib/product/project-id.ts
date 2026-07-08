const PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]{3,96}$/;

export function normalizeProjectId(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const projectId = value.trim();
	return PROJECT_ID_PATTERN.test(projectId) ? projectId : undefined;
}
