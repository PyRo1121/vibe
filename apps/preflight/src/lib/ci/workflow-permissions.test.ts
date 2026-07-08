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

	it('strips real YAML comments while preserving hashes inside quoted values', () => {
		const result = analyzeWorkflowPermissions(`
permissions: # real comment
  contents: read # allow checkout
  packages: "write#still-value"
  checks: write
`);

		expect(result).toMatchObject({
			declaresPermissions: true,
			contentsRead: true,
			writeAll: false,
			writeScopes: ['checks']
		});
	});

	it('handles quoted inline maps', () => {
		expect(
			analyzeWorkflowPermissions('permissions: { "contents": "read", "checks": "write" }')
		).toMatchObject({
			declaresPermissions: true,
			contentsRead: true,
			writeScopes: ['checks']
		});
	});

	it('skips malformed inline map entries without dropping valid scopes', () => {
		expect(
			analyzeWorkflowPermissions('permissions: { malformed, contents: read, checks: write }')
		).toMatchObject({
			declaresPermissions: true,
			contentsRead: true,
			writeScopes: ['checks']
		});
	});

	it('ignores malformed child lines without dropping valid permission scopes', () => {
		const result = analyzeWorkflowPermissions(`
permissions:
  contents: read
  this is not a permission child
  pull-requests: write
`);

		expect(result).toMatchObject({
			declaresPermissions: true,
			contentsRead: true,
			writeScopes: ['pull-requests']
		});
	});

	it('treats read-all as declared permissions without write access', () => {
		expect(analyzeWorkflowPermissions('permissions: read-all')).toMatchObject({
			declaresPermissions: true,
			contentsRead: false,
			writeAll: false,
			writeScopes: []
		});
	});

	it('handles single-quoted scalar permissions', () => {
		expect(analyzeWorkflowPermissions("permissions: 'write-all'")).toMatchObject({
			declaresPermissions: true,
			writeAll: true
		});
	});
});
