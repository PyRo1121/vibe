/** README score badge — shields.io-style flat SVG, no external services. */

const COLORS = {
	green: '#3fb950',
	amber: '#d29922',
	red: '#f85149',
	label: '#30363d'
} as const;

export function badgeColor(score: number): string {
	if (score >= 80) return COLORS.green;
	if (score >= 60) return COLORS.amber;
	return COLORS.red;
}

/** Approximate text width at 11px Verdana — the shields.io convention. */
function textWidth(text: string): number {
	return Math.round(text.length * 6.6) + 12;
}

export function buildBadgeSvg(score: number): string {
	const label = 'preflight';
	const value = `${score}/100`;
	const labelW = textWidth(label);
	const valueW = textWidth(value);
	const width = labelW + valueW;
	const color = badgeColor(score);

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${label}: ${value}">
<title>${label}: ${value}</title>
<clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)">
<rect width="${labelW}" height="20" fill="${COLORS.label}"/>
<rect x="${labelW}" width="${valueW}" height="20" fill="${color}"/>
</g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${labelW / 2}" y="14">${label}</text>
<text x="${labelW + valueW / 2}" y="14" font-weight="bold">${value}</text>
</g>
</svg>`;
}
