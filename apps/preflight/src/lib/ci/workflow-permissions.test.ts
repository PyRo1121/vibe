import { describe, expect, it } from 'vitest';

import { analyzeWorkflowPermissions } from './workflow-permissions';

describe('analyzeWorkflowPermissions', () => {
	it('reads top-level and job-level permission blocks', () => {
		const topLevel = analyzeWorkflowPermissions(`
permissions:
  contents: read
  packages: write
`);
		const jobLevel = analyzeWorkflowPermissions(`
jobs:
  verify:
    permissions:
      contents: read
      pull-requests: write
`);

		expect(topLevel).toMatchObject({
			declaresPermissions: true,
			contentsRead: true,
			writeScopes: ['packages']
		});
		expect(jobLevel).toMatchObject({
			declaresPermissions: true,
			contentsRead: true,
			writeScopes: ['pull-requests']
		});
	});

	it('ignores unrelated write values outside permissions maps', () => {
		const result = analyzeWorkflowPermissions(`
permissions:
  contents: read
jobs:
  verify:
    steps:
      - uses: acme/action@v1
        with:
          mode: write
`);

		expect(result).toMatchObject({
			declaresPermissions: true,
			contentsRead: true,
			writeAll: false,
			writeScopes: []
		});
	});

	it('handles inline maps and write-all', () => {
		expect(
			analyzeWorkflowPermissions('permissions: { contents: read, checks: write }')
		).toMatchObject({
			contentsRead: true,
			writeScopes: ['checks']
		});
		expect(analyzeWorkflowPermissions('permissions: write-all')).toMatchObject({
			declaresPermissions: true,
			writeAll: true
		});
	});
});
