import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import * as page from "./route";
import * as file from "./[file]/route";

/**
 * I-02 step 8 — the contract page. It serves docs/keel-api.yaml itself, never
 * a copy; it serves Swagger UI from the pinned package; and it serves nothing
 * else.
 */
const get = (name: string) =>
  file.GET(new Request(`http://keel.test/docs/${name}`), {
    params: Promise.resolve({ file: name }),
  });

describe("the contract page", () => {
  it("serves a page that loads only this origin's scripts", async () => {
    const res = page.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toContain(
      "script-src 'self'",
    );
    const html = await res.text();
    expect(html).toContain("Requests here are real.");
    expect(html).not.toMatch(/src="https?:/);
  });

  it("serves the contract byte for byte as it is in the repository", async () => {
    const res = await get("keel-api.yaml");
    expect(res.status).toBe(200);
    const served = Buffer.from(await res.arrayBuffer());
    expect(served.equals(await readFile("docs/keel-api.yaml"))).toBe(true);
  });

  it.each(["swagger-ui.css", "swagger-ui-bundle.js", "init.js", "page.css"])(
    "serves %s",
    async (name) => {
      const res = await get(name);
      expect(res.status).toBe(200);
      expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(0);
    },
  );

  it.each(["package.json", "../.env", "index.html", "constructor"])(
    "404s %s, which is not on the list",
    async (name) => {
      expect((await get(name)).status).toBe(404);
    },
  );
});
