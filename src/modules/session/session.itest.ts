import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { getConfig } from "@/config/env";
import { query } from "@/shared/db";
import { sessionOf } from "@/shared/session";
import { cookieFor } from "@/test/session";
import { testSigner } from "@/test/idToken";
import * as session from "@/app/v1/session/route";
import * as day from "@/app/v1/day/[date]/route";
import { testUser } from "@/test/fixtures";
import { issuerFor } from "./domain/session";
import { fetchSigningKeys, KEYS_TIMEOUT_MS } from "./cognito";

/**
 * I-04 step 4 — turning a Cognito sign-in into a session, every response the
 * contract declares, against real Postgres. Cognito is never reached: its
 * published keys are replaced by a test key, and tokens are signed with it,
 * so each case says exactly what the token carries. The one test of the real
 * key fetch is its timeout, against a server that never replies.
 *
 * Every case uses a fresh subject and email, so the four per-timezone runs
 * share one database without colliding.
 */
vi.mock("./cognito", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./cognito")>();
  return { ...actual, fetchSigningKeys: vi.fn(actual.fetchSigningKeys) };
});
const keys = vi.mocked(fetchSigningKeys);

const signer = testSigner();
const BASE = "http://keel.test";
const ORIGIN = new URL(getConfig().appBaseUrl).origin;

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** Claims as Cognito would issue them for this pool and client, just signed in. */
function claims(over: Record<string, unknown> = {}) {
  const { cognito } = getConfig();
  return {
    iss: issuerFor(cognito.poolId),
    aud: cognito.clientId,
    token_use: "id",
    exp: nowSeconds() + 300,
    auth_time: nowSeconds(),
    sub: `itest|${randomUUID()}`,
    email: `itest-${randomUUID()}@keel.test`,
    email_verified: true,
    name: "Itest Person",
    ...over,
  };
}

function exchange(
  body: unknown,
  origin: string | null = ORIGIN,
  raw?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (origin) headers.origin = origin;
  return session.POST(
    new Request(`${BASE}/v1/session`, {
      method: "POST",
      headers,
      body: raw ?? JSON.stringify(body),
    }),
  );
}

const withToken = (c: object) => exchange({ id_token: signer.token(c) });

/** The user the response's session cookie names. */
function sessionUser(res: Response) {
  const c = res.headers
    .getSetCookie()
    .find((s) => s.startsWith("keel_session="));
  if (!c) return null;
  return sessionOf(c.split(";")[0], new Date(), getConfig().sessionSecret);
}

async function problemOf(res: Response) {
  expect(res.headers.get("content-type")).toBe("application/problem+json");
  return (await res.json()) as { status: number; type: string };
}

/** Every line the app writes to the console while `run` runs. */
async function logged(run: () => Promise<unknown>): Promise<string> {
  const lines: string[] = [];
  const capture = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  const spies = [
    vi.spyOn(console, "log").mockImplementation(capture),
    vi.spyOn(console, "error").mockImplementation(capture),
    vi.spyOn(console, "warn").mockImplementation(capture),
  ];
  try {
    await run();
  } finally {
    for (const s of spies) s.mockRestore();
  }
  return lines.join("\n");
}

describe("POST /v1/session", () => {
  beforeEach(() => {
    keys.mockReset();
    keys.mockResolvedValue({ ok: true, keys: [signer.jwk] });
  });

  it("403 without Keel's own Origin, decided before any key is fetched", async () => {
    for (const origin of [null, "https://evil.example", "http://keel.test"]) {
      const res = await exchange({ id_token: signer.token(claims()) }, origin);
      expect((await problemOf(res)).status).toBe(403);
      expect(sessionUser(res)).toBeNull();
    }
    expect(keys).not.toHaveBeenCalled();
  });

  it("400 when the body names no token", async () => {
    for (const body of [{}, { id_token: "" }, { id_token: 7 }, null]) {
      expect((await problemOf(await exchange(body))).status).toBe(400);
    }
    expect(
      (await problemOf(await exchange(null, ORIGIN, "not json"))).status,
    ).toBe(400);
    expect(keys).not.toHaveBeenCalled();
  });

  it("401 for a token Keel does not accept, writing nothing", async () => {
    const stranger = testSigner(signer.jwk.kid);
    const cases: [string, Promise<Response>][] = [
      ["bad signature", exchange({ id_token: stranger.token(claims()) })],
      ["not a JWT", exchange({ id_token: "not-a-token" })],
      [
        "another pool",
        withToken(claims({ iss: issuerFor("us-east-1_Elsewhere") })),
      ],
      ["another client", withToken(claims({ aud: "another-client" }))],
      ["an access token", withToken(claims({ token_use: "access" }))],
      ["expired", withToken(claims({ exp: nowSeconds() - 1 }))],
      ["unverified email", withToken(claims({ email_verified: false }))],
      [
        "a sign-in older than five minutes",
        withToken(claims({ auth_time: nowSeconds() - 301 })),
      ],
    ];
    for (const [name, pending] of cases) {
      const res = await pending;
      expect((await problemOf(res)).status, name).toBe(401);
      expect(sessionUser(res), name).toBeNull();
    }
  });

  it("accepts a sign-in up to five minutes old", async () => {
    const res = await withToken(claims({ auth_time: nowSeconds() - 290 }));
    expect(res.status).toBe(204);
  });

  it("503 when Cognito's keys cannot be fetched", async () => {
    keys.mockResolvedValueOnce({ ok: false, kind: "unavailable" });
    const res = await withToken(claims());
    expect((await problemOf(res)).status).toBe(503);
    expect(sessionUser(res)).toBeNull();
  });

  it("creates the user on a first sign-in, with the name in the session, and uses it on the next", async () => {
    const identity = claims();

    const res1 = await withToken(identity);
    expect(res1.status).toBe(204);
    const user = sessionUser(res1);
    expect(user).toMatchObject({ email: identity.email, name: "Itest Person" });
    expect(res1.headers.get("set-cookie")).toMatch(
      /^keel_session=[^;]+; Path=\/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax$/,
    );

    const row = await query<{ email: string; idp_subject: string }>(
      `SELECT email, idp_subject FROM "user" WHERE id = $1`,
      [user!.id],
    );
    expect(row.rows[0]).toEqual({
      email: identity.email,
      idp_subject: identity.sub,
    });

    const res2 = await withToken({ ...identity, name: "Renamed" });
    expect(sessionUser(res2)).toEqual({ ...user, name: "Renamed" });
  });

  it("409 when the email belongs to another subject, writing nothing", async () => {
    const email = `itest-${randomUUID()}@keel.test`;
    await withToken(claims({ email }));

    const recreated = claims({ email });
    const res = await withToken(recreated);
    expect((await problemOf(res)).status).toBe(409);
    expect(sessionUser(res)).toBeNull();
    const rows = await query(`SELECT 1 FROM "user" WHERE idp_subject = $1`, [
      recreated.sub,
    ]);
    expect(rows.rowCount).toBe(0);
  });

  it("never logs the token, whatever the answer", async () => {
    const tokens = [
      signer.token(claims()),
      signer.token(claims({ aud: "another-client" })),
      testSigner(signer.jwk.kid).token(claims()),
    ];
    const out = await logged(async () => {
      for (const t of tokens) await exchange({ id_token: t });
      keys.mockResolvedValueOnce({ ok: false, kind: "unavailable" });
      await exchange({ id_token: tokens[0] });
      await exchange({ id_token: tokens[0] }, "https://evil.example");
    });
    expect(out).toContain("POST /v1/session");
    for (const t of tokens) {
      for (const segment of t.split(".")) expect(out).not.toContain(segment);
    }
  });
});

describe("GET /v1/session", () => {
  const get = (cookie?: string) =>
    session.GET(
      new Request(`${BASE}/v1/session`, {
        headers: cookie ? { cookie } : {},
      }),
    );

  it("names the signed-in user from the cookie", async () => {
    const id = randomUUID();
    const res = await get(
      cookieFor(id, new Date(), "rohit@keel.test", "Rohit"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id,
      email: "rohit@keel.test",
      name: "Rohit",
    });
  });

  it("falls back to the email before the @ for an account with no name", async () => {
    const res = await get(
      cookieFor(randomUUID(), new Date(), "rohit.y@keel.test", null),
    );
    expect(((await res.json()) as { name: string }).name).toBe("rohit.y");
  });

  it("401 without a session", async () => {
    expect((await problemOf(await get())).status).toBe(401);
  });
});

describe("an open session while Cognito is unreachable", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps working: no request that reads the cookie reaches the network", async () => {
    const user = await testUser();
    const offline = vi.fn(() => Promise.reject(new Error("network is down")));
    vi.stubGlobal("fetch", offline);

    const me = await session.GET(
      new Request(`${BASE}/v1/session`, { headers: { cookie: user.cookie } }),
    );
    expect(me.status).toBe(200);

    const today = await day.GET(
      new Request(`${BASE}/v1/day/2026-10-21`, {
        headers: { cookie: user.cookie },
      }),
      { params: Promise.resolve({ date: "2026-10-21" }) },
    );
    expect(today.status).toBe(200);
    expect(offline).not.toHaveBeenCalled();
  });
});

describe("the real key fetch", () => {
  let server: Server;

  afterAll(async () => {
    server?.closeAllConnections();
    await new Promise((r) => server?.close(r));
  });

  it("gives up on a Cognito that never answers, within its timeout", async () => {
    // Accepts the connection and never replies.
    server = createServer(() => {});
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as AddressInfo;

    // The module is mocked for the exchange cases; this one is the real fetch.
    const real = await vi.importActual<typeof import("./cognito")>("./cognito");
    const t0 = Date.now();
    const result = await real.fetchSigningKeys(`http://127.0.0.1:${port}`);
    const elapsed = Date.now() - t0;

    expect(result).toEqual({ ok: false, kind: "unavailable" });
    expect(elapsed).toBeGreaterThanOrEqual(KEYS_TIMEOUT_MS - 50);
    expect(elapsed).toBeLessThan(KEYS_TIMEOUT_MS + 2000);
  });
});

describe("DELETE /v1/session", () => {
  const del = (cookie?: string) =>
    session.DELETE(
      new Request(`${BASE}/v1/session`, {
        method: "DELETE",
        headers: cookie ? { cookie } : {},
      }),
      undefined,
    );

  it("401 without a session", async () => {
    expect((await problemOf(await del())).status).toBe(401);
  });

  it("204 and a cleared cookie with one", async () => {
    const res = await del(cookieFor(randomUUID()));
    expect(res.status).toBe(204);
    expect(res.headers.get("set-cookie")).toBe(
      "keel_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
    );
  });
});
