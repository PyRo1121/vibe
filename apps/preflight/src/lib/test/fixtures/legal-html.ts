/** Realistic legal-page fixture — enough visible words to pass the stub threshold. */
const PARAGRAPH =
	'We collect only the information required to operate this service, including account ' +
	'details you provide and technical data generated when you use the product. We never sell ' +
	'personal information to third parties. Data is stored with industry-standard encryption ' +
	'at rest and in transit, and access is limited to personnel who need it to run the service. ' +
	'You may request deletion of your account and associated records at any time by writing to ' +
	'our support address, and we will honor verified requests within thirty days as required by ' +
	'applicable regulation. Payment details are processed by our payment provider and are never ' +
	'stored on our servers. Cookies are used solely for session management and product analytics.';

export const LEGAL_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head><title>Privacy Policy</title></head>
<body>
  <h1>Privacy Policy</h1>
  <p>${PARAGRAPH}</p>
  <p>${PARAGRAPH}</p>
</body>
</html>`;

export const STUB_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head><title>Privacy</title></head>
<body><h1>Privacy</h1><p>We respect your privacy.</p></body>
</html>`;
