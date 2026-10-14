import { notFound } from "@/shared/http";
import { ASSETS, CSP, INIT_JS, readAsset } from "../assets";

export const dynamic = "force-dynamic";

/** The page's own stylesheet: the banner, and nothing that hides by colour alone (NFR-13). */
const PAGE_CSS = `.keel-banner {
  margin: 0;
  padding: 12px 16px;
  border-bottom: 2px solid #8a5a00;
  background: #fff4dc;
  color: #2b1d00;
  font: 14px/1.5 system-ui, sans-serif;
}
.keel-banner a { color: inherit; font-weight: 600; }
`;

const headers = (type: string) => ({
  "content-type": type,
  "content-security-policy": CSP,
  "x-content-type-options": "nosniff",
});

/**
 * GET /docs/{file} — an allowlist. Anything not named here is a 404, so the
 * route can never be asked for another file on disk.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ file: string }> },
): Promise<Response> {
  const { file } = await ctx.params;
  if (file === "init.js") {
    return new Response(INIT_JS, {
      headers: headers("text/javascript; charset=utf-8"),
    });
  }
  if (file === "page.css") {
    return new Response(PAGE_CSS, {
      headers: headers("text/css; charset=utf-8"),
    });
  }
  const asset = Object.hasOwn(ASSETS, file) ? ASSETS[file] : undefined;
  if (!asset) return notFound("file");
  return new Response(new Uint8Array(await readAsset(file)), {
    headers: headers(asset.type),
  });
}
