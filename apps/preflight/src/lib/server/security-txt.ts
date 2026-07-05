/** RFC 9116 security disclosure — dogfood what we ask customers to ship. */
export const SECURITY_TXT_BODY = `Contact: mailto:security@latham.cloud
Expires: 2027-07-04T00:00:00.000Z
Preferred-Languages: en
Canonical: https://lint.latham.cloud/.well-known/security.txt
Policy: https://lint.latham.cloud/privacy

# Deploylint — report security issues responsibly.
# We appreciate coordinated disclosure; do not test against customer scan targets.
`;

export function securityTxtResponse(): Response {
	return new Response(SECURITY_TXT_BODY, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=86400'
		}
	});
}
