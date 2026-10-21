"use client";

import { Amplify } from "aws-amplify";
import {
  confirmResetPassword,
  confirmSignUp,
  fetchAuthSession,
  resendSignUpCode,
  resetPassword,
  signIn,
  signOut,
  signUp,
} from "aws-amplify/auth";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import type { KeyValueStorageInterface } from "aws-amplify/utils";

/**
 * The browser's side of signing in (ADR-002), and the only file that imports
 * Amplify. The password goes from here to Cognito and nowhere else: sign-in
 * proves it with SRP, so not even Cognito receives it then; creating an
 * account and resetting a password send it to Cognito over TLS. Keel's server
 * only ever receives the ID token, at `POST /v1/session`.
 *
 * Cognito's tokens live in memory, in `store`, from the sign-in until the
 * exchange answers — never in localStorage, sessionStorage or a cookie. Then
 * Amplify's sign-out empties the store and revokes the refresh token, and a
 * full page load discards everything this page held.
 */

/** Amplify's token storage, kept in memory and nowhere else. */
class MemoryStore implements KeyValueStorageInterface {
  private readonly items = new Map<string, string>();
  async setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  async getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  async removeItem(key: string) {
    this.items.delete(key);
  }
  async clear() {
    this.items.clear();
  }
  get size() {
    return this.items.size;
  }
}

const store = new MemoryStore();

/** How many entries Amplify holds right now. Zero outside a sign-in. */
export const heldEntries = (): number => store.size;

let configured = false;

/**
 * Point Amplify at the pool. The ids come from the server at runtime, never
 * from the build (ADR-004). Safe to call more than once.
 */
export function configureAuth(cognito: { poolId: string; clientId: string }) {
  if (configured) return;
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: cognito.poolId,
        userPoolClientId: cognito.clientId,
        loginWith: { email: true },
      },
    },
  });
  cognitoUserPoolsTokenProvider.setKeyValueStorage(store);
  configured = true;
}

/**
 * How an attempt ended. A failure carries Cognito's error name (a thrown
 * `NotAuthorizedException`, say), `not_confirmed` when the account's email is
 * not confirmed yet, or `exchange_<status>` when Keel refused the token. The
 * screens turn it into words (`domain/authScreens.ts`).
 */
export type Outcome = { ok: true } | { ok: false; reason: string };

/**
 * Cognito's error name. A locked-out account comes back as the same
 * `NotAuthorizedException` as a wrong password, told apart only by its
 * message, so it gets a name of its own here.
 */
function failure(e: unknown): { ok: false; reason: string } {
  if (!(e instanceof Error) || !e.name) return { ok: false, reason: "Unknown" };
  if (
    e.name === "NotAuthorizedException" &&
    /attempts exceeded/i.test(e.message)
  ) {
    return { ok: false, reason: "PasswordAttemptsExceeded" };
  }
  return { ok: false, reason: e.name };
}

/**
 * Sign in and exchange the ID token for Keel's session — the one way to get a
 * session (ADR-002). On success the browser goes to `next` with a full page
 * load; the caller never sees a token.
 */
export async function signInToKeel(
  email: string,
  password: string,
  next = "/",
): Promise<Outcome> {
  let status: number;
  try {
    const { nextStep } = await signIn({
      username: email,
      password,
      options: { authFlowType: "USER_SRP_AUTH" },
    });
    if (nextStep.signInStep === "CONFIRM_SIGN_UP") {
      return { ok: false, reason: "not_confirmed" };
    }
    if (nextStep.signInStep !== "DONE") {
      return { ok: false, reason: `step_${nextStep.signInStep}` };
    }

    const idToken = (await fetchAuthSession()).tokens?.idToken?.toString();
    if (!idToken) return { ok: false, reason: "no_token" };

    const exchanged = await fetch("/v1/session", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id_token: idToken }),
    });
    status = exchanged.status;
  } catch (e) {
    return failure(e);
  } finally {
    // Whatever happened, Cognito's tokens go: the store is emptied and the
    // refresh token revoked. A failure here leaves nothing to keep either.
    await signOut().catch(() => store.clear());
  }

  if (status !== 204) return { ok: false, reason: `exchange_${status}` };
  window.location.assign(next);
  return { ok: true };
}

/** Create the account; Cognito emails the code that confirms it. */
export async function createAccount(
  name: string,
  email: string,
  password: string,
): Promise<Outcome> {
  try {
    await signUp({
      username: email,
      password,
      options: { userAttributes: { email, name } },
    });
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

/** Confirm the email with its code, then sign in — no other way in. */
export async function confirmAccount(
  email: string,
  password: string,
  code: string,
): Promise<Outcome> {
  try {
    await confirmSignUp({ username: email, confirmationCode: code });
  } catch (e) {
    return failure(e);
  }
  return signInToKeel(email, password);
}

/** Send a new confirmation code. */
export async function resendCode(email: string): Promise<Outcome> {
  try {
    await resendSignUpCode({ username: email });
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

/**
 * Ask for a reset code. Cognito answers alike whether or not the address has
 * an account (prevent_user_existence_errors), and so does the screen.
 */
export async function startReset(email: string): Promise<Outcome> {
  try {
    await resetPassword({ username: email });
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

/** Set the new password with the code, then sign in with it. */
export async function finishReset(
  email: string,
  code: string,
  newPassword: string,
  next: string,
): Promise<Outcome> {
  try {
    await confirmResetPassword({
      username: email,
      confirmationCode: code,
      newPassword,
    });
  } catch (e) {
    return failure(e);
  }
  return signInToKeel(email, newPassword, next);
}
