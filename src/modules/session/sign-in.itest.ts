import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getConfig } from "@/config/env";
import { query } from "@/shared/db";
import { sessionCookie, sessionUserId } from "@/shared/session";
import * as signIn from "@/app/v1/session/sign-in/route";
import * as callback from "@/app/v1/session/callback/route";
import * as session from "@/app/v1/session/route";
import { issuerFor } from "./domain/session";
import { EXCHANGE_TIMEOUT_MS, exchangeCode, type Exchange } from "./idp";

/**
 * I-02 step 4 — signing in and out, every response the contract declares,
 * against real Postgres. The provider is never reached: the token exchange is
 * replaced, so each case says exactly what the provider answered. The one
 * test of the real exchange is its timeout, against a server that never
 * replies.
 *
 * Every case uses a fresh subject and email, so the four per-timezone runs
 * share one database without colliding.
 */
vi.mock("./idp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./idp")>();
  return { ...actual, exchangeCode: vi.fn(actual.exchangeCode) };
});
const exchange = vi.mocked(exchangeCode);

const BASE = "http://keel.test";

/** Start a sign-in; return the cookie the browser holds and the state it carries. */
async function started(): Promise<{ cookie: string; state: string }> {
  const res = await signIn.GET();
  const state = new URL(res.headers.get("location")!).searchParams.get(
    "state",
  )!;
  const cookie = res.headers.get("set-cookie")!.split(";")[0];
  return { cookie, state };
}

function callbackRequest(
  state: string,
  cookie: string | null,
  code = "the-code",
): Request {
  return new Request(
    `${BASE}/v1/session/callback?code=${code}&state=${encodeURIComponent(state)}`,
    { headers: cookie ? { cookie } : {} },
  );
}

/** Claims as the provider would issue them for this pool and client. */
function claims(over: Record<string, unknown> = {}) {
  const { cognito } = getConfig();
  return {
    iss: issuerFor(cognito.poolId),
    aud: cognito.clientId,
    token_use: "id",
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: `itest|${randomUUID()}`,
    email: `itest-${randomUUID()}@keel.test`,
    email_verified: true,
    ...over,
  };
}

const answers = (result: Exchange) => exchange.mockResolvedValueOnce(result);

const setCookies = (res: Response): string[] => res.headers.getSetCookie();

/** The user the response's session cookie names. */
function sessionUser(res: Response): string | null {
  const c = setCookies(res).find((s) => s.startsWith("keel_session="));
  if (!c) return null;
  return sessionUserId(c.split(";")[0], new Date(), getConfig().sessionSecret);
}

async function problemOf(res: Response) {
  expect(res.headers.get("content-type")).toBe("application/problem+json");
  return (await res.json()) as { status: number; type: string };
}

describe("GET /v1/session/sign-in", () => {
  it("redirects to the provider with a PKCE challenge and remembers the attempt", async () => {
    const res = await signIn.GET();
    expect(res.status).toBe(302);
    const to = new URL(res.headers.get("location")!);
    expect(to.origin).toBe(getConfig().cognito.domain);
    expect(to.pathname).toBe("/oauth2/authorize");
    expect(to.searchParams.get("response_type")).toBe("code");
    expect(to.searchParams.get("code_challenge_method")).toBe("S256");
    expect(to.searchParams.get("redirect_uri")).toBe(
      `${getConfig().appBaseUrl}/v1/session/callback`,
    );
    expect(to.searchParams.get("state")).toBeTruthy();
    expect(res.headers.get("set-cookie")).toMatch(
      /^keel_sign_in=.+; Path=\/v1\/session; Max-Age=600; HttpOnly; Secure; SameSite=Lax$/,
    );
  });
});

describe("GET /v1/session/callback", () => {
  beforeEach(() => exchange.mockClear());

  it("400 when the browser did not start this sign-in, and asks nothing of the provider", async () => {
    const { cookie } = await started();
    for (const req of [
      callbackRequest("some-state", null),
      callbackRequest("not-the-state-it-left-with", cookie),
    ]) {
      const res = await callback.GET(req);
      expect((await problemOf(res)).status).toBe(400);
      expect(setCookies(res)).toEqual([]);
    }
    expect(exchange).not.toHaveBeenCalled();
  });

  it("401 when the provider refuses the code", async () => {
    const { cookie, state } = await started();
    answers({ ok: false, kind: "refused" });
    const res = await callback.GET(callbackRequest(state, cookie));
    expect((await problemOf(res)).status).toBe(401);
    expect(sessionUser(res)).toBeNull();
  });

  it("401 when the identity is not one Keel accepts", async () => {
    for (const bad of [
      claims({ email_verified: false }),
      claims({ aud: "another-client" }),
      claims({ iss: issuerFor("us-east-1_Elsewhere") }),
    ]) {
      const { cookie, state } = await started();
      answers({ ok: true, claims: bad });
      const res = await callback.GET(callbackRequest(state, cookie));
      expect((await problemOf(res)).status).toBe(401);
      expect(sessionUser(res)).toBeNull();
    }
  });

  it("503 when the provider cannot be reached", async () => {
    const { cookie, state } = await started();
    answers({ ok: false, kind: "unavailable" });
    const res = await callback.GET(callbackRequest(state, cookie));
    expect((await problemOf(res)).status).toBe(503);
  });

  it("creates the user on a first sign-in, and uses it on the next", async () => {
    const identity = claims();

    const first = await started();
    answers({ ok: true, claims: identity });
    const res1 = await callback.GET(callbackRequest(first.state, first.cookie));
    expect(res1.status).toBe(302);
    expect(res1.headers.get("location")).toBe("/");
    const userId = sessionUser(res1);
    expect(userId).toBeTruthy();
    // The sign-in cookie is spent.
    expect(setCookies(res1)).toContain(
      "keel_sign_in=; Path=/v1/session; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
    );

    const row = await query<{ email: string; idp_subject: string }>(
      `SELECT email, idp_subject FROM "user" WHERE id = $1`,
      [userId],
    );
    expect(row.rows[0]).toEqual({
      email: identity.email,
      idp_subject: identity.sub,
    });

    const second = await started();
    answers({ ok: true, claims: identity });
    const res2 = await callback.GET(
      callbackRequest(second.state, second.cookie),
    );
    expect(sessionUser(res2)).toBe(userId);
  });

  it("409 when the email belongs to another subject, writing nothing", async () => {
    const email = `itest-${randomUUID()}@keel.test`;

    const first = await started();
    answers({ ok: true, claims: claims({ email }) });
    await callback.GET(callbackRequest(first.state, first.cookie));

    const recreated = claims({ email });
    const second = await started();
    answers({ ok: true, claims: recreated });
    const res = await callback.GET(
      callbackRequest(second.state, second.cookie),
    );
    expect((await problemOf(res)).status).toBe(409);
    expect(sessionUser(res)).toBeNull();

    const rows = await query(`SELECT 1 FROM "user" WHERE idp_subject = $1`, [
      recreated.sub,
    ]);
    expect(rows.rowCount).toBe(0);
  });
});

describe("the real token exchange", () => {
  let server: Server;

  afterAll(async () => {
    server?.closeAllConnections();
    await new Promise((r) => server?.close(r));
  });

  it("gives up on a provider that never answers, within its timeout", async () => {
    // Accepts the connection and never replies.
    server = createServer(() => {});
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as AddressInfo;

    const t0 = Date.now();
    const result = await exchangeCode(
      {
        domain: `http://127.0.0.1:${port}`,
        clientId: "c",
        clientSecret: "s",
      },
      "http://localhost:3000/v1/session/callback",
      "code",
      "verifier",
    );
    const elapsed = Date.now() - t0;

    expect(result).toEqual({ ok: false, kind: "unavailable" });
    expect(elapsed).toBeGreaterThanOrEqual(EXCHANGE_TIMEOUT_MS - 50);
    expect(elapsed).toBeLessThan(EXCHANGE_TIMEOUT_MS + 2000);
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
    const cookie = sessionCookie(
      randomUUID(),
      new Date(),
      getConfig().sessionSecret,
    ).split(";")[0];
    const res = await del(cookie);
    expect(res.status).toBe(204);
    expect(res.headers.get("set-cookie")).toBe(
      "keel_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
    );
  });
});
