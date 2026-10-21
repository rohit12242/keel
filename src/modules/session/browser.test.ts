import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The browser's sign-in, with Amplify replaced: what is called in what
 * order, what reaches Keel, and that nothing is left held afterwards. Real
 * SRP against the real pool is proved live (plan, *Proof*).
 */
const calls: string[] = [];
const amplify = vi.hoisted(() => ({
  store: null as null | {
    setItem(k: string, v: string): Promise<void>;
    clear(): Promise<void>;
  },
}));

vi.mock("aws-amplify", () => ({
  Amplify: { configure: vi.fn(() => calls.push("configure")) },
}));
vi.mock("aws-amplify/auth/cognito", () => ({
  cognitoUserPoolsTokenProvider: {
    setKeyValueStorage: vi.fn((s) => {
      amplify.store = s;
    }),
  },
}));
vi.mock("aws-amplify/auth", () => ({
  signIn: vi.fn(async () => {
    calls.push("signIn");
    // As Amplify does: the tokens land in the configured store.
    await amplify.store!.setItem("idToken", "the.id.token");
    await amplify.store!.setItem("refreshToken", "the-refresh-token");
    return { isSignedIn: true, nextStep: { signInStep: "DONE" } };
  }),
  fetchAuthSession: vi.fn(async () => {
    calls.push("fetchAuthSession");
    return { tokens: { idToken: { toString: () => "the.id.token" } } };
  }),
  signOut: vi.fn(async () => {
    calls.push("signOut");
    await amplify.store!.clear();
  }),
  signUp: vi.fn(async () => calls.push("signUp")),
  confirmSignUp: vi.fn(async () => calls.push("confirmSignUp")),
  resendSignUpCode: vi.fn(async () => calls.push("resendSignUpCode")),
  resetPassword: vi.fn(async () => calls.push("resetPassword")),
  confirmResetPassword: vi.fn(async () => calls.push("confirmResetPassword")),
}));

const auth = await import("aws-amplify/auth");
const { cognitoUserPoolsTokenProvider } =
  await import("aws-amplify/auth/cognito");
const browser = await import("./browser");

const assign = vi.fn();
let posted: { url: string; init: RequestInit }[];

function keelAnswers(status: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push("POST /v1/session");
      posted.push({ url, init });
      return new Response(null, { status });
    }),
  );
}

beforeEach(() => {
  calls.length = 0;
  posted = [];
  assign.mockClear();
  vi.stubGlobal("window", { location: { assign } });
  keelAnswers(204);
  browser.configureAuth({ poolId: "us-east-1_AbC123", clientId: "client" });
});

afterEach(() => vi.unstubAllGlobals());

describe("configureAuth", () => {
  it("keeps Amplify's tokens in memory, never in browser storage", async () => {
    const store = vi.mocked(cognitoUserPoolsTokenProvider.setKeyValueStorage)
      .mock.calls[0][0];
    expect(store).toBe(amplify.store);
    // What Amplify writes lands in Keel's own in-memory store — the one
    // heldEntries counts — not in any browser storage.
    await store.setItem("probe", "x");
    expect(browser.heldEntries()).toBe(1);
    await store.clear();
    expect(browser.heldEntries()).toBe(0);
  });
});

describe("signInToKeel", () => {
  it("signs in with SRP, exchanges the ID token, drops every token, then loads the page", async () => {
    expect(
      await browser.signInToKeel("r@example.com", "a long password"),
    ).toEqual({
      ok: true,
    });
    expect(calls).toEqual([
      "signIn",
      "fetchAuthSession",
      "POST /v1/session",
      "signOut",
    ]);
    expect(vi.mocked(auth.signIn).mock.calls[0][0]).toEqual({
      username: "r@example.com",
      password: "a long password",
      options: { authFlowType: "USER_SRP_AUTH" },
    });
    expect(browser.heldEntries()).toBe(0);
    expect(assign).toHaveBeenCalledWith("/");
  });

  it("sends Keel the ID token and nothing else — never the password", async () => {
    await browser.signInToKeel("r@example.com", "a long password");
    expect(posted).toHaveLength(1);
    const { url, init } = posted[0];
    expect(url).toBe("/v1/session");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({
      id_token: "the.id.token",
    });
    expect(init.body).not.toContain("a long password");
  });

  it("drops the tokens even when Keel refuses them, and stays on the page", async () => {
    keelAnswers(401);
    expect(await browser.signInToKeel("r@example.com", "pw")).toEqual({
      ok: false,
      reason: "exchange_401",
    });
    expect(calls.at(-1)).toBe("signOut");
    expect(browser.heldEntries()).toBe(0);
    expect(assign).not.toHaveBeenCalled();
  });

  it("drops the tokens even when signing out at Cognito fails", async () => {
    vi.mocked(auth.signOut).mockRejectedValueOnce(new Error("offline"));
    await browser.signInToKeel("r@example.com", "pw");
    expect(browser.heldEntries()).toBe(0);
  });

  it("reports Cognito's refusal by its name, and asks Keel for nothing", async () => {
    vi.mocked(auth.signIn).mockRejectedValueOnce(
      Object.assign(new Error("Incorrect username or password."), {
        name: "NotAuthorizedException",
      }),
    );
    expect(await browser.signInToKeel("r@example.com", "pw")).toEqual({
      ok: false,
      reason: "NotAuthorizedException",
    });
    expect(posted).toEqual([]);
  });

  it("tells a locked-out account apart from a wrong password", async () => {
    vi.mocked(auth.signIn).mockRejectedValueOnce(
      Object.assign(new Error("Password attempts exceeded"), {
        name: "NotAuthorizedException",
      }),
    );
    expect(await browser.signInToKeel("r@example.com", "pw")).toEqual({
      ok: false,
      reason: "PasswordAttemptsExceeded",
    });
  });

  it("says so when the account's email is not confirmed yet", async () => {
    vi.mocked(auth.signIn).mockResolvedValueOnce({
      isSignedIn: false,
      nextStep: { signInStep: "CONFIRM_SIGN_UP" },
    } as never);
    expect(await browser.signInToKeel("r@example.com", "pw")).toEqual({
      ok: false,
      reason: "not_confirmed",
    });
    expect(posted).toEqual([]);
  });
});

describe("creating an account and resetting a password", () => {
  it("asks for the name with the account", async () => {
    await browser.createAccount("Rohit", "r@example.com", "pw");
    expect(vi.mocked(auth.signUp).mock.calls[0][0]).toEqual({
      username: "r@example.com",
      password: "pw",
      options: { userAttributes: { email: "r@example.com", name: "Rohit" } },
    });
  });

  it("confirming ends with the same sign-in and exchange", async () => {
    await browser.confirmAccount("r@example.com", "pw", "123456");
    expect(calls).toEqual([
      "confirmSignUp",
      "signIn",
      "fetchAuthSession",
      "POST /v1/session",
      "signOut",
    ]);
  });

  it("a reset ends with the same sign-in and exchange, with the new password", async () => {
    await browser.finishReset("r@example.com", "123456", "new pw", "/?reset=1");
    expect(calls).toEqual([
      "confirmResetPassword",
      "signIn",
      "fetchAuthSession",
      "POST /v1/session",
      "signOut",
    ]);
    expect(vi.mocked(auth.signIn).mock.calls.at(-1)![0]).toMatchObject({
      password: "new pw",
    });
    expect(assign).toHaveBeenCalledWith("/?reset=1");
  });

  it("a wrong code stops before any sign-in", async () => {
    vi.mocked(auth.confirmSignUp).mockRejectedValueOnce(
      Object.assign(new Error("bad code"), { name: "CodeMismatchException" }),
    );
    expect(
      await browser.confirmAccount("r@example.com", "pw", "000000"),
    ).toEqual({
      ok: false,
      reason: "CodeMismatchException",
    });
    expect(calls).not.toContain("signIn");
  });
});
