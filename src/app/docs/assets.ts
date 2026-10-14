import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * What the contract page serves, and nothing else (I-02). The contract is
 * read from docs/keel-api.yaml itself — never a copy — and Swagger UI from the
 * pinned swagger-ui-dist package, so no script on this origin comes from a
 * third party: the page runs alongside the session cookie.
 *
 * The files are read from disk relative to the working directory. The
 * standalone image carries them because next.config.ts names them in
 * outputFileTracingIncludes.
 */
const SWAGGER = join("node_modules", "swagger-ui-dist");

export const ASSETS: Record<string, { path: string; type: string }> = {
  "keel-api.yaml": {
    path: join("docs", "keel-api.yaml"),
    type: "application/yaml; charset=utf-8",
  },
  "swagger-ui.css": {
    path: join(SWAGGER, "swagger-ui.css"),
    type: "text/css; charset=utf-8",
  },
  "swagger-ui-bundle.js": {
    path: join(SWAGGER, "swagger-ui-bundle.js"),
    type: "text/javascript; charset=utf-8",
  },
};

// turbopackIgnore: without it the tracer cannot tell which files a computed
// path reads, and copies the whole project into the image. The three files
// are named for it instead (next.config.ts).
export const readAsset = (name: string): Promise<Buffer> =>
  readFile(join(/* turbopackIgnore: true */ process.cwd(), ASSETS[name].path));

/**
 * The page's own script. Same-origin requests carry the session cookie, so
 * "Try it out" acts as whoever is signed in; signed out, it gets the
 * contract's 401.
 */
export const INIT_JS = `window.addEventListener("load", function () {
  window.SwaggerUIBundle({
    url: "/docs/keel-api.yaml",
    dom_id: "#swagger-ui",
    deepLinking: true,
  });
});
`;

/**
 * Only this origin may supply script, style, fonts or a connection. Swagger
 * UI sets style attributes and draws icons from data: URIs, hence those two
 * allowances; nothing may frame the page.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join("; ");
