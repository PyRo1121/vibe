import type { ScanCheck } from '$lib/scan/types';
import { describe, expect, it } from 'vitest';

import { aiCrawlerAccess, pushAiReadinessChecks } from './ai-readiness';

const CTX = { url: 'https://app.test' };

const ALL_AI_CRAWLERS = [
	'GPTBot',
	'ClaudeBot',
	'Claude-Web',
	'PerplexityBot',
	'Google-Extended',
	'anthropic-ai',
	'CCBot'
];

function runChecks(html: string, robotsText: string | null = null): ScanCheck[] {
	const checks: ScanCheck[] = [];
	pushAiReadinessChecks(checks, html, robotsText, CTX);
	return checks;
}

function findCheck(checks: ScanCheck[], id: string): ScanCheck | undefined {
	return checks.find((c) => c.id === id);
}

describe('aiCrawlerAccess', () => {
	it('blocks every AI crawler when the * group disallows the whole site', () => {
		const res = aiCrawlerAccess('User-agent: *\nDisallow: /');
		expect([...res.blocked].toSorted()).toEqual([...ALL_AI_CRAWLERS].toSorted());
		expect(res.allowed).toEqual([]);
	});

	it('treats an empty Disallow in a bot-specific group as allowed even when * is blocked', () => {
		const text = 'User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nDisallow:';
		const res = aiCrawlerAccess(text);
		expect(res.allowed).toEqual(['GPTBot']);
		expect(res.blocked).toContain('ClaudeBot');
		expect(res.blocked).toHaveLength(ALL_AI_CRAWLERS.length - 1);
	});

	it('applies one rule block to every agent in a multi User-agent group', () => {
		const text = 'User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /';
		const res = aiCrawlerAccess(text);
		expect([...res.blocked].toSorted()).toEqual(['ClaudeBot', 'GPTBot']);
		expect(res.allowed).toContain('PerplexityBot');
	});

	it('does not count partial-path disallows as a full block', () => {
		const res = aiCrawlerAccess('User-agent: *\nDisallow: /private');
		expect(res.blocked).toEqual([]);
		expect([...res.allowed].toSorted()).toEqual([...ALL_AI_CRAWLERS].toSorted());
	});

	it('matches agents and directives case-insensitively', () => {
		const res = aiCrawlerAccess('user-agent: gptbot\ndisallow: /');
		expect(res.blocked).toEqual(['GPTBot']);
	});
});

describe('ai-crawlers check', () => {
	it('warns when robots.txt blocks all AI crawlers', () => {
		const checks = runChecks('<html></html>', 'User-agent: *\nDisallow: /');
		const check = findCheck(checks, 'ai-crawlers');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('blocks AI crawlers');
		expect(check?.message).toContain('ChatGPT/Perplexity');
	});

	it('warns naming the specific bots when only some are blocked', () => {
		const robots = 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow: /admin';
		const check = findCheck(runChecks('<html></html>', robots), 'ai-crawlers');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('GPTBot');
		expect(check?.message).not.toContain('ClaudeBot');
	});

	it('passes when no AI crawler is blocked', () => {
		const check = findCheck(runChecks('<html></html>', 'User-agent: *\nAllow: /'), 'ai-crawlers');
		expect(check?.status).toBe('pass');
		expect(check?.message).toContain('AI crawlers may index the site');
	});

	it('emits nothing when robots.txt was not fetched', () => {
		expect(findCheck(runChecks('<html></html>', null), 'ai-crawlers')).toBeUndefined();
	});
});

describe('text-ratio check', () => {
	it('is skipped for pages under 20KB', () => {
		const html = '<html><body><p>Small page.</p></body></html>';
		expect(findCheck(runChecks(html), 'text-ratio')).toBeUndefined();
	});

	it('warns when under 2% of a large page is readable text', () => {
		const html = `<html><body><p>Hi.</p>${'<span data-pad="filler"></span>'.repeat(1200)}</body></html>`;
		const check = findCheck(runChecks(html), 'text-ratio');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('Under 2% of the HTML is readable text');
	});

	it('excludes script content from readable text', () => {
		const html = `<html><body><p>Tiny visible line.</p><script>${'var pad = "text text text"; '.repeat(1000)}</script></body></html>`;
		const check = findCheck(runChecks(html), 'text-ratio');
		expect(check?.status).toBe('warn');
	});

	it('passes and reports the percentage on text-rich pages', () => {
		const html = `<html><body>${'<p>Deploylint scans your app for launch readiness and reports what to fix fast.</p>'.repeat(400)}</body></html>`;
		const check = findCheck(runChecks(html), 'text-ratio');
		expect(check?.status).toBe('pass');
		expect(check?.message).toMatch(/~\d+% of HTML is readable text/);
	});
});

describe('semantic-html check', () => {
	it('is skipped when the body has fewer than 50 elements', () => {
		const html = '<html><body><h1>Hi</h1><div>x</div></body></html>';
		expect(findCheck(runChecks(html), 'semantic-html')).toBeUndefined();
	});

	it('warns on div-only markup with no semantic landmarks', () => {
		const html = `<html><body><h1>Product</h1>${'<div><span>x</span></div>'.repeat(30)}</body></html>`;
		const check = findCheck(runChecks(html), 'semantic-html');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('Div-only markup');
	});

	it('passes and counts landmarks when semantic elements are present', () => {
		const html = `<html><body><main><h1>T</h1><section><p>a</p></section><section><p>b</p></section><nav></nav><footer></footer>${'<div>x</div>'.repeat(45)}</main></body></html>`;
		const check = findCheck(runChecks(html), 'semantic-html');
		expect(check?.status).toBe('pass');
		expect(check?.message).toContain('Semantic structure present (6 landmarks/sections)');
	});
});

describe('answer-signals check', () => {
	it('passes when a citable one-liner follows the H1', () => {
		const html =
			'<html><body><h1>Acme</h1><p>Acme is a launch readiness scanner that checks your site before you ship it live.</p></body></html>';
		const check = findCheck(runChecks(html), 'answer-signals');
		expect(check?.status).toBe('pass');
	});

	it('passes when FAQPage JSON-LD is present', () => {
		const html =
			'<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[]}</script></head><body><h2>FAQ</h2></body></html>';
		const check = findCheck(runChecks(html), 'answer-signals');
		expect(check?.status).toBe('pass');
	});

	it('passes when a meta description of 50+ characters exists', () => {
		const html =
			'<html><head><meta name="description" content="Deploylint checks your vibe-coded app for SEO, legal, and security issues before launch."></head><body></body></html>';
		const check = findCheck(runChecks(html), 'answer-signals');
		expect(check?.status).toBe('pass');
	});

	it('warns when the page offers nothing citable', () => {
		const html =
			'<html><head><meta name="description" content="Too short."></head><body><h1>Hi</h1><p>Short.</p><div>Also short.</div></body></html>';
		const check = findCheck(runChecks(html), 'answer-signals');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('No citable summary');
	});
});

describe('og-site-name check', () => {
	it('warns when other og: tags exist without og:site_name', () => {
		const html =
			'<html><head><meta property="og:title" content="Acme"><meta property="og:image" content="https://app.test/og.png"></head></html>';
		const check = findCheck(runChecks(html), 'og-site-name');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('og:site_name missing');
	});

	it('passes when og:site_name is present', () => {
		const html =
			'<html><head><meta property="og:title" content="Acme"><meta property="og:site_name" content="Acme"></head></html>';
		const check = findCheck(runChecks(html), 'og-site-name');
		expect(check?.status).toBe('pass');
	});

	it('emits nothing when the page has no og: tags at all', () => {
		const html = '<html><head><title>Acme</title></head></html>';
		expect(findCheck(runChecks(html), 'og-site-name')).toBeUndefined();
	});
});

describe('pushAiReadinessChecks', () => {
	it('emits only seo-category pass/warn checks with fix prompts', () => {
		const html = `<html><head><meta property="og:title" content="Acme"></head><body><h1>Product</h1>${'<div><span>x</span></div>'.repeat(30)}</body></html>`;
		const checks = runChecks(html, 'User-agent: *\nDisallow: /');
		expect(checks.length).toBeGreaterThanOrEqual(4);
		for (const check of checks) {
			expect(check.category).toBe('seo');
			expect(['pass', 'warn']).toContain(check.status);
			expect(check.fixPrompt.length).toBeGreaterThan(0);
		}
	});
});
