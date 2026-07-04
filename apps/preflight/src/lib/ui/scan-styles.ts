import type { ScanReport } from '$lib/scan/types';

export const categoryLabels: Record<string, string> = {
	seo: 'SEO',
	legal: 'Legal',
	security: 'Security',
	a11y: 'Accessibility',
	mobile: 'Mobile',
	launch: 'Launch',
	payments: 'Payments'
};

export const verdictLabels = {
	go: 'GO',
	conditional: 'CONDITIONAL GO',
	'no-go': 'NO-GO'
} as const;

export function scoreColor(score: number): string {
	if (score >= 80) return 'text-emerald-400';
	if (score >= 60) return 'text-amber-400';
	return 'text-red-400';
}

export function verdictClass(verdict: ScanReport['verdict']): string {
	if (verdict === 'go') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
	if (verdict === 'conditional') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
	return 'border-red-500/30 bg-red-500/10 text-red-300';
}

export function statusIcon(status: string): string {
	if (status === 'pass') return '✓';
	if (status === 'warn') return '!';
	return '✕';
}

export function statusClass(status: string): string {
	if (status === 'pass') return 'text-emerald-400 bg-emerald-500/10';
	if (status === 'warn') return 'text-amber-400 bg-amber-500/10';
	return 'text-red-400 bg-red-500/10';
}

export function priorityClass(priority?: string): string {
	if (priority === 'p0') return 'bg-red-500/20 text-red-300';
	if (priority === 'p1') return 'bg-amber-500/20 text-amber-300';
	return 'bg-zinc-700 text-zinc-400';
}
