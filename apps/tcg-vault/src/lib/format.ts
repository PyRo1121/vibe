export function formatUsd(value: number | null | undefined): string {
	if (value == null || Number.isNaN(value)) return '—';
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}
