import type { ScanCheck } from '$lib/scan/types';
import { fixPrompt } from '$lib/scan/prompts';
import { makeCheck } from '$lib/scan/score';

const AI_CRAWLERS = [
	'GPTBot',
	'ClaudeBot',
	'Claude-Web',
	'PerplexityBot',
	'Google-Extended',
	'anthropic-ai',
	'CCBot'
] as const;

function canonicalAgent(name: string): string | null {
	const lower = name.toLowerCase();
	for (const bot of AI_CRAWLERS) {
		if (bot.toLowerCase() === lower) return bot;
	}
	return null;
}

interface RobotsGroup {
	agents: string[];
	disallows: string[];
}

function parseRobotsGroups(text: string): RobotsGroup[] {
	const groups: RobotsGroup[] = [];
	let current: RobotsGroup | null = null;

	for (const rawLine of text.split('\n')) {
		const line = rawLine.split('#')[0].trim();
		if (!line) continue;
		const colon = line.indexOf(':');
		if (colon === -1) continue;
		const key = line.slice(0, colon).trim().toLowerCase();
		const value = line.slice(colon + 1).trim();

		if (key === 'user-agent') {
			if (!current || current.disallows.length > 0) {
				current = { agents: [], disallows: [] };
				groups.push(current);
			}
			current.agents.push(value);
		} else if (key === 'disallow' && current) {
			current.disallows.push(value);
		}
	}
	return groups;
}

function agentBlocked(agent: string, groups: RobotsGroup[]): boolean {
	const lower = agent.toLowerCase();
	let blocked = false;

	for (const group of groups) {
		const applies =
			group.agents.some((a) => a === '*') ||
			group.agents.some((a) => a.toLowerCase() === lower);
		if (!applies) continue;

		if (group.disallows.some((d) => d === '/')) {
			blocked = true;
		} else if (group.disallows.some((d) => d === '')) {
			blocked = false;
		}
	}
	return blocked;
}

export function aiCrawlerAccess(robotsText: string): { blocked: string[]; allowed: string[] } {
	const groups = parseRobotsGroups(robotsText);
	const blocked: string[] = [];
	const allowed: string[] = [];

	for (const bot of AI_CRAWLERS) {
		if (agentBlocked(bot, groups)) blocked.push(bot);
		else allowed.push(bot);
	}
	return { blocked, allowed };
}

function stripForText(html: string): string {
	return html
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<(script|style|svg|noscript)\b[\s\S]*?<\/\1\s*>/gi, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function metaContent(html: string, name: string): string | null {
	const re = new RegExp(
		`<meta\\b[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']|` +
			`<meta\\b[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`,
		'i'
	);
	const m = html.match(re);
	return (m?.[1] ?? m?.[2] ?? null)?.trim() ?? null;
}

function hasOgTags(html: string): boolean {
	return /<meta\b[^>]*property=["']og:/i.test(html);
}

function pushAiCrawlersCheck(
	checks: ScanCheck[],
	robotsText: string | null,
	ctx: { url: string }
): void {
	if (robotsText == null) return;

	const { blocked, allowed } = aiCrawlerAccess(robotsText);
	if (blocked.length === AI_CRAWLERS.length) {
		checks.push(
			makeCheck(
				'ai-crawlers',
				'seo',
				'AI crawler access',
				'warn',
				'robots.txt blocks AI crawlers (GPTBot, ClaudeBot, …) — your product will not appear in ChatGPT/Perplexity answers; intentional for some, fatal for discovery',
				fixPrompt('ai-crawlers', ctx)
			)
		);
		return;
	}
	if (blocked.length > 0) {
		checks.push(
			makeCheck(
				'ai-crawlers',
				'seo',
				'AI crawler access',
				'warn',
				`robots.txt blocks ${blocked.join(', ')} — those AI assistants cannot index this site`,
				fixPrompt('ai-crawlers', ctx)
			)
		);
		return;
	}
	checks.push(
		makeCheck(
			'ai-crawlers',
			'seo',
			'AI crawler access',
			'pass',
			'AI crawlers may index the site (GPTBot, ClaudeBot, PerplexityBot unblocked)',
			fixPrompt('ai-crawlers', ctx)
		)
	);
}

function pushTextRatioCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	const totalBytes = html.length;
	if (totalBytes <= 20 * 1024) return;

	const visible = stripForText(html);
	const ratio = visible.length / totalBytes;
	const pct = Math.round(ratio * 100);

	if (ratio < 0.02) {
		const kb = Math.round(totalBytes / 1024);
		const vkb = Math.round(visible.length / 1024);
		checks.push(
			makeCheck(
				'text-ratio',
				'seo',
				'Readable text ratio',
				'warn',
				`Under 2% of the HTML is readable text (~${vkb}KB of ${kb}KB) — AI crawlers and search engines see mostly markup; ensure content is server-rendered`,
				fixPrompt('text-ratio', ctx)
			)
		);
		return;
	}

	checks.push(
		makeCheck(
			'text-ratio',
			'seo',
			'Readable text ratio',
			'pass',
			`~${pct}% of HTML is readable text`,
			fixPrompt('text-ratio', ctx)
		)
	);
}

const SEMANTIC_TAGS = ['article', 'main', 'section', 'nav', 'header', 'footer', 'aside'];

function pushSemanticHtmlCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
	const elementCount = (body.match(/<[a-z][^>]*>/gi) ?? []).length;
	if (elementCount < 50) return;

	const divCount = (body.match(/<div\b/gi) ?? []).length;
	let semanticCount = 0;
	for (const tag of SEMANTIC_TAGS) {
		semanticCount += (body.match(new RegExp(`<${tag}\\b`, 'gi')) ?? []).length;
	}
	for (let i = 1; i <= 6; i++) {
		semanticCount += (body.match(new RegExp(`<h${i}\\b`, 'gi')) ?? []).length;
	}

	const landmarkTags = SEMANTIC_TAGS.reduce(
		(n, tag) => n + (body.match(new RegExp(`<${tag}\\b`, 'gi')) ?? []).length,
		0
	);

	if (landmarkTags === 0 && divCount >= 30) {
		checks.push(
			makeCheck(
				'semantic-html',
				'seo',
				'Semantic HTML',
				'warn',
				'Div-only markup — semantic HTML (<main>, <article>, <section>) helps AI and assistive tech understand the page',
				fixPrompt('semantic-html', ctx)
			)
		);
		return;
	}

	checks.push(
		makeCheck(
			'semantic-html',
			'seo',
			'Semantic HTML',
			'pass',
			`Semantic structure present (${semanticCount} landmarks/sections)`,
			fixPrompt('semantic-html', ctx)
		)
	);
}

function pushAnswerSignalsCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	const description = metaContent(html, 'description');
	if (description && description.length >= 50) {
		checks.push(
			makeCheck(
				'answer-signals',
				'seo',
				'Citable summary',
				'pass',
				'Meta description gives AI and search engines a citable summary',
				fixPrompt('answer-signals', ctx)
			)
		);
		return;
	}

	if (/FAQPage/i.test(html)) {
		checks.push(
			makeCheck(
				'answer-signals',
				'seo',
				'Citable summary',
				'pass',
				'FAQ structured data gives AI assistants quotable answers',
				fixPrompt('answer-signals', ctx)
			)
		);
		return;
	}

	const h1Match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
	if (h1Match) {
		const afterH1 = html.slice(html.indexOf(h1Match[0]) + h1Match[0].length, html.indexOf(h1Match[0]) + h1Match[0].length + 5000);
		for (const m of afterH1.matchAll(/<(?:p|div)\b[^>]*>([\s\S]*?)<\/(?:p|div)>/gi)) {
			const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
			if (text.length >= 40 && text.length <= 300) {
				checks.push(
					makeCheck(
						'answer-signals',
						'seo',
						'Citable summary',
						'pass',
						'Hero copy gives AI assistants a quotable one-liner',
						fixPrompt('answer-signals', ctx)
					)
				);
				return;
			}
		}
	}

	checks.push(
		makeCheck(
			'answer-signals',
			'seo',
			'Citable summary',
			'warn',
			'No citable summary — add a one-sentence description near the H1 and a meta description so AI answers quote you accurately',
			fixPrompt('answer-signals', ctx)
		)
	);
}

function pushOgSiteNameCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	if (!hasOgTags(html)) return;
	const siteName = metaContent(html, 'og:site_name');
	checks.push(
		makeCheck(
			'og-site-name',
			'seo',
			'og:site_name',
			siteName ? 'pass' : 'warn',
			siteName
				? `og:site_name set to "${siteName}"`
				: 'og:site_name missing — AI assistants and link unfurlers fall back to the domain name for attribution',
			fixPrompt('og-site-name', ctx)
		)
	);
}

export function pushAiReadinessChecks(
	checks: ScanCheck[],
	html: string,
	robotsText: string | null,
	ctx: { url: string }
): void {
	pushAiCrawlersCheck(checks, robotsText, ctx);
	pushTextRatioCheck(checks, html, ctx);
	pushSemanticHtmlCheck(checks, html, ctx);
	pushAnswerSignalsCheck(checks, html, ctx);
	pushOgSiteNameCheck(checks, html, ctx);
}
