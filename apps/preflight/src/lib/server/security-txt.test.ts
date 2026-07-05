import { DEFAULT_DEPLOYLINT_API } from '@vibe/deploylint-shared';
import { describe, expect, it } from 'vitest';

import { SECURITY_TXT_BODY, securityTxtResponse } from './security-txt';

describe('securityTxtResponse', () => {
	it('serves RFC 9116 disclosure metadata with cache headers', async () => {
		const response = securityTxtResponse();

		expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400');
		expect(await response.text()).toBe(SECURITY_TXT_BODY);
		expect(SECURITY_TXT_BODY).toContain('Contact: mailto:security@latham.cloud');
		expect(SECURITY_TXT_BODY).toContain(
			`Canonical: ${DEFAULT_DEPLOYLINT_API}/.well-known/security.txt`
		);
	});
});
