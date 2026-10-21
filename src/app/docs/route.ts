import { CSP } from "./assets";

export const dynamic = "force-static";

/**
 * GET /docs — the contract, interactive (I-02). A page, not an API
 * operation, so it is not in docs/keel-api.yaml. The banner is the spec's:
 * on the deployed service a request is a real write, and nothing is deleted.
 */
const PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Keel API</title>
  <link rel="stylesheet" href="/docs/swagger-ui.css">
  <link rel="stylesheet" href="/docs/page.css">
</head>
<body>
  <p class="keel-banner" role="note">
    <strong>Requests here are real.</strong> Each one acts as whoever is signed in.
    On the deployed service it writes into the real record, and the record deletes
    nothing. Signed out, every protected request is refused with 401.
    <a href="/sign-in">Sign in</a>
  </p>
  <div id="swagger-ui"></div>
  <script src="/docs/swagger-ui-bundle.js"></script>
  <script src="/docs/init.js"></script>
</body>
</html>
`;

export function GET(): Response {
  return new Response(PAGE, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": CSP,
      "x-content-type-options": "nosniff",
    },
  });
}
