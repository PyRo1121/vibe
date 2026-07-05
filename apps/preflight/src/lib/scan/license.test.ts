import { describe, expect, it } from 'vitest';

import {
	auditScriptText,
	buildLicenseAudit,
	classifySpdx,
	detectLibraries,
	licenseCheckStatus,
	mergeLibraries
} from './license';

const base = new URL('https://app.test/');

describe('detectLibraries', () => {
	it('parses jsdelivr npm URLs with version', () => {
		const html = `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js"></script>`;
		const libs = detectLibraries(html, base);
		expect(libs).toHaveLength(1);
		expect(libs[0]).toMatchObject({
			name: 'chart.js',
			version: '4.4.0',
			spdx: 'MIT',
			sellable: 'yes'
		});
	});

	it('parses cdnjs and canonicalizes aliases', () => {
		const html = `<script src="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/5.3.0/js/bootstrap.min.js"></script>`;
		const libs = detectLibraries(html, base);
		expect(libs[0]).toMatchObject({ name: 'bootstrap', version: '5.3.0', sellable: 'yes' });
	});

	it('parses unpkg scoped and unscoped packages', () => {
		const html = `
			<script src="https://unpkg.com/@popperjs/core@2.11.8/dist/umd/popper.min.js"></script>
			<script src="https://unpkg.com/htmx.org@1.9.10"></script>`;
		const names = detectLibraries(html, base).map((l) => l.name);
		expect(names).toContain('@popperjs/core');
		expect(names).toContain('htmx.org');
	});

	it('detects google fonts from stylesheet host', () => {
		const html = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">`;
		const libs = detectLibraries(html, base);
		expect(libs[0]).toMatchObject({ name: 'google-fonts', sellable: 'yes' });
	});

	it('detects self-hosted copies of known libraries by filename', () => {
		const html = `<script src="/assets/jquery-3.6.0.min.js"></script>`;
		const libs = detectLibraries(html, base);
		expect(libs[0]).toMatchObject({ name: 'jquery', version: '3.6.0' });
	});

	it('flags commercial-license libraries like highcharts', () => {
		const html = `<script src="https://cdnjs.cloudflare.com/ajax/libs/highcharts/11.4.0/highcharts.min.js"></script>`;
		const libs = detectLibraries(html, base);
		expect(libs[0].sellable).toBe('conditions');
		expect(libs[0].note).toContain('paid Highcharts license');
	});

	it('flags polyfill.io as a risk regardless of license', () => {
		const html = `<script src="https://cdn.polyfill.io/v3/polyfill.min.js"></script>`;
		const libs = detectLibraries(html, base);
		expect(libs[0]).toMatchObject({ name: 'polyfill-io', sellable: 'risk' });
	});

	it('dedupes the same library from multiple URLs', () => {
		const html = `
			<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
			<script src="/vendor/jquery.min.js"></script>`;
		const libs = detectLibraries(html, base);
		expect(libs).toHaveLength(1);
		expect(libs[0].version).toBe('3.7.1');
	});

	it('ignores unrecognizable first-party bundles', () => {
		const html = `<script src="/_app/immutable/chunks/Bo9W_VnB.js"></script>`;
		expect(detectLibraries(html, base)).toHaveLength(0);
	});
});

describe('classifySpdx', () => {
	it('classifies license families by sell rights', () => {
		expect(classifySpdx('MIT').sellable).toBe('yes');
		expect(classifySpdx('Apache-2.0').sellable).toBe('yes');
		expect(classifySpdx('LGPL-3.0').sellable).toBe('conditions');
		expect(classifySpdx('MPL-2.0').sellable).toBe('conditions');
		expect(classifySpdx('GPL-3.0').sellable).toBe('risk');
		expect(classifySpdx('AGPL-3.0').sellable).toBe('risk');
		expect(classifySpdx('CC-BY-NC-4.0').sellable).toBe('risk');
		expect(classifySpdx('SomethingElse-1.0').sellable).toBe('unknown');
	});
});

describe('auditScriptText', () => {
	it('flags GPL SPDX identifiers in bundles', () => {
		const finding = auditScriptText(
			'/* SPDX-License-Identifier: GPL-3.0-only */ var x = 1;',
			'https://app.test/bundle.js'
		);
		expect(finding).not.toBeNull();
		expect(finding?.sellable).toBe('risk');
		expect(finding?.source).toBe('bundle.js');
	});

	it('flags GNU GPL text banners', () => {
		const finding = auditScriptText(
			'/* This program is free software under the GNU General Public License */',
			'https://app.test/legacy.js'
		);
		expect(finding?.sellable).toBe('risk');
	});

	it('stays silent for permissive banners', () => {
		expect(auditScriptText('/* SPDX-License-Identifier: MIT */', 'a.js')).toBeNull();
		expect(auditScriptText('var noLicenseHere = true;', 'b.js')).toBeNull();
	});
});

describe('buildLicenseAudit', () => {
	it('is clear-to-sell when nothing is detected', () => {
		const audit = buildLicenseAudit([]);
		expect(audit.sellable).toBe('yes');
		expect(licenseCheckStatus(audit)).toBe('pass');
	});

	it('overall verdict is the worst library verdict', () => {
		const html = `
			<script src="https://cdn.jsdelivr.net/npm/react@18.2.0/umd/react.production.min.js"></script>
			<script src="https://cdnjs.cloudflare.com/ajax/libs/highcharts/11.4.0/highcharts.min.js"></script>`;
		const audit = buildLicenseAudit(detectLibraries(html, base));
		expect(audit.sellable).toBe('conditions');
		expect(licenseCheckStatus(audit)).toBe('warn');
		expect(audit.summary).toContain('conditions');
	});

	it('fails the check when a sell-risk library is present', () => {
		const gpl = auditScriptText('/* SPDX-License-Identifier: AGPL-3.0 */', 'x.js');
		const audit = buildLicenseAudit(gpl ? [gpl] : []);
		expect(audit.sellable).toBe('risk');
		expect(licenseCheckStatus(audit)).toBe('fail');
	});
});

describe('mergeLibraries', () => {
	it('dedupes by name and sorts worst sellability first', () => {
		const html = `
			<script src="https://cdn.jsdelivr.net/npm/vue@3.4.0/dist/vue.global.js"></script>
			<script src="https://cdnjs.cloudflare.com/ajax/libs/highcharts/11.4.0/highcharts.min.js"></script>`;
		const detected = detectLibraries(html, base);
		const merged = mergeLibraries(detected, detected);
		expect(merged).toHaveLength(2);
		expect(merged[0].name).toBe('highcharts');
	});
});
