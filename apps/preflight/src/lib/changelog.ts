/** Minimal Keep-a-Changelog renderer — no external markdown deps. */

function escapeHtml(text: string): string {
	return text
		.replaceAll(/&/g, '&amp;')
		.replaceAll(/</g, '&lt;')
		.replaceAll(/>/g, '&gt;')
		.replaceAll(/"/g, '&quot;');
}

function inlineMarkdown(text: string): string {
	const escaped = escapeHtml(text);
	return escaped.replaceAll(
		/\[([^\]]+)\]\(([^)]+)\)/g,
		'<a class="text-sky-400 hover:underline" href="$2">$1</a>'
	);
}

/** Convert CHANGELOG.md body to safe HTML for /changelog. */
export function renderChangelogHtml(markdown: string): string {
	const lines = markdown.split('\n');
	const out: string[] = [];
	let inList = false;

	const closeList = () => {
		if (inList) {
			out.push('</ul>');
			inList = false;
		}
	};

	for (const line of lines) {
		if (line.startsWith('## [')) {
			closeList();
			const title = line.replace(/^##\s+/, '');
			out.push(
				`<h2 class="mt-10 mb-3 text-xl font-semibold text-white">${inlineMarkdown(title)}</h2>`
			);
			continue;
		}
		if (line.startsWith('### ')) {
			closeList();
			out.push(
				`<h3 class="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">${inlineMarkdown(line.slice(4))}</h3>`
			);
			continue;
		}
		if (line.startsWith('- ')) {
			if (!inList) {
				out.push('<ul class="mb-4 list-disc space-y-2 pl-6 text-zinc-300">');
				inList = true;
			}
			out.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
			continue;
		}
		if (line.startsWith('[') && line.includes(']:')) {
			closeList();
			continue;
		}
		if (!line.trim()) {
			closeList();
			continue;
		}
		closeList();
		out.push(`<p class="mb-4 text-zinc-300">${inlineMarkdown(line)}</p>`);
	}

	closeList();
	return out.join('\n');
}
