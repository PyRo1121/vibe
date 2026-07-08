export interface WorkflowPermissionAnalysis {
	declaresPermissions: boolean;
	contentsRead: boolean;
	writeAll: boolean;
	writeScopes: string[];
}

function stripYamlComment(line: string): string {
	let quote: '"' | "'" | null = null;
	for (let index = 0; index < line.length; index += 1) {
		const char = line[index];
		if ((char === '"' || char === "'") && line[index - 1] !== '\\') {
			quote = quote === char ? null : (quote ?? char);
			continue;
		}
		if (char === '#' && quote == null) return line.slice(0, index);
	}
	return line;
}

function meaningfulLines(text: string): string[] {
	return text
		.split(/\r?\n/)
		.map((line) => stripYamlComment(line).replace(/\s+$/, ''))
		.filter((line) => line.trim().length > 0);
}

function indentOf(line: string): number {
	return line.match(/^\s*/)?.[0].length ?? 0;
}

function unquoteYamlScalar(value: string): string {
	const trimmed = value.trim();
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

function parseInlinePermissionMap(raw: string): Array<[string, string]> {
	const body = raw.match(/^\{(?<body>.*)\}$/)?.groups?.body;
	if (!body) return [];

	const pairs: Array<[string, string]> = [];
	for (const entry of body.split(',')) {
		const pair = entry.match(/^\s*['"]?([a-z-]+)['"]?\s*:\s*(.+?)\s*$/i);
		if (!pair?.[1] || !pair[2]) continue;
		pairs.push([pair[1].toLowerCase(), unquoteYamlScalar(pair[2]).toLowerCase()]);
	}
	return pairs;
}

function recordPermission(
	analysis: WorkflowPermissionAnalysis,
	scope: string,
	value: string,
	writeScopes: Set<string>
) {
	if (scope === 'contents' && value === 'read') analysis.contentsRead = true;
	if (value === 'write') writeScopes.add(scope);
}

export function analyzeWorkflowPermissions(text: string): WorkflowPermissionAnalysis {
	const lines = meaningfulLines(text);
	const writeScopes = new Set<string>();
	const analysis: WorkflowPermissionAnalysis = {
		declaresPermissions: false,
		contentsRead: false,
		writeAll: false,
		writeScopes: []
	};

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? '';
		const match = line.match(/^\s*permissions\s*:\s*(?<value>.*)$/i);
		if (!match) continue;

		analysis.declaresPermissions = true;
		const permissionIndent = indentOf(line);
		const value = unquoteYamlScalar(match.groups?.value ?? '').toLowerCase();
		if (value === 'write-all') {
			analysis.writeAll = true;
			continue;
		}

		for (const [scope, permission] of parseInlinePermissionMap(value)) {
			recordPermission(analysis, scope, permission, writeScopes);
		}

		if (value !== '') continue;

		for (let childIndex = index + 1; childIndex < lines.length; childIndex += 1) {
			const child = lines[childIndex] ?? '';
			if (indentOf(child) <= permissionIndent) break;

			const pair = child.match(/^\s*['"]?([a-z-]+)['"]?\s*:\s*(.+?)\s*$/i);
			if (!pair?.[1] || !pair[2]) continue;
			recordPermission(
				analysis,
				pair[1].toLowerCase(),
				unquoteYamlScalar(pair[2]).toLowerCase(),
				writeScopes
			);
		}
	}

	return {
		...analysis,
		writeScopes: [...writeScopes].toSorted()
	};
}
