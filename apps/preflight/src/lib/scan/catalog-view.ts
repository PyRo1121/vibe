import type { CheckPriority } from '$lib/scan/types';
import type { CheckCatalogEntry } from './catalog';
import { checkPriority } from './verdict';

export interface CatalogGroup {
	priority: CheckPriority;
	label: string;
	description: string;
	entries: CheckCatalogEntry[];
}

const GROUP_COPY: Record<CheckPriority, { label: string; description: string }> = {
	p0: {
		label: 'Launch blockers',
		description: 'Checks that can make a launch unsafe, invisible, unreachable, or legally risky.'
	},
	p1: {
		label: 'Important issues',
		description:
			'Checks that can hurt trust, security posture, SEO, or conversion during a real launch.'
	},
	p2: {
		label: 'Polish and readiness',
		description: 'Checks that make the product feel more complete and easier to operate.'
	}
};

export function buildCatalogGroups(entries: CheckCatalogEntry[]): CatalogGroup[] {
	const groups = new Map<CheckPriority, CheckCatalogEntry[]>();
	for (const entry of entries) {
		const priority = checkPriority(entry.id);
		groups.set(priority, [...(groups.get(priority) ?? []), entry]);
	}

	return (['p0', 'p1', 'p2'] as const)
		.map((priority) => {
			const copy = GROUP_COPY[priority];
			return {
				priority,
				label: copy.label,
				description: copy.description,
				entries: (groups.get(priority) ?? []).sort((a, b) => a.id.localeCompare(b.id))
			};
		})
		.filter((group) => group.entries.length > 0);
}

const ACRONYMS = new Set(['ai', 'api', 'csp', 'hsts', 'https', 'mime', 'p0']);

export function catalogTitle(id: string): string {
	return id
		.split('-')
		.map((part, index) => {
			if (ACRONYMS.has(part)) return part.toUpperCase();
			if (index > 0) return part;
			return part.charAt(0).toUpperCase() + part.slice(1);
		})
		.join(' ');
}
