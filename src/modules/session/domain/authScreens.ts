/**
 * The sign-in screens' rules (`docs/design/screens/02-auth-and-onboarding.md`),
 * pure: what each field must hold and what it says when it doesn't, the
 * password length counter, the code input, the resend wait, and the words
 * for each answer from Cognito. The screens draw; this decides.
 */

/** Cognito's password policy: at least 12 characters, nothing else. */
export const MIN_PASSWORD = 12;

/** The emailed code is six digits. */
export const CODE_LENGTH = 6;

/** How long "Send a new code" waits before it can be asked again. */
export const RESEND_WAIT_SECONDS = 60;

export type Screen = "sign_in" | "create_account" | "reset";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The email field's error, or null when it is fine. */
export function emailError(value: string, screen: Screen): string | null {
  const email = value.trim();
  if (email === "") {
    return screen === "create_account"
      ? "Enter your email, like you@example.com."
      : "Enter the email on your account.";
  }
  if (!EMAIL.test(email)) {
    return "Check the email: it needs an @ and a domain, like you@example.com.";
  }
  return null;
}

/**
 * The password field's error. Signing in only needs one; a new password —
 * on Create account or at a reset — must meet the policy.
 */
export function passwordError(value: string, screen: Screen): string | null {
  if (screen === "sign_in") {
    return value === "" ? "Enter your password." : null;
  }
  if (value === "") {
    return screen === "reset"
      ? "Enter a new password of at least 12 characters."
      : "Enter a password of at least 12 characters.";
  }
  const short = MIN_PASSWORD - [...value].length;
  return short > 0 ? `Use at least 12 characters. ${short} more to go.` : null;
}

export const nameError = (value: string): string | null =>
  value.trim() === "" ? "Enter your name. Only you will see it." : null;

export const honestyError = (ticked: boolean): string | null =>
  ticked ? null : "Tick this to continue.";

export const codeError = (code: string): string | null =>
  code.length === CODE_LENGTH ? null : "Enter the 6-digit code from the email.";

/** What the length counter shows under a new password. */
export type LengthCounter = {
  text: string;
  /** How full the bar is, 0 to 1. */
  fill: number;
  tone: "empty" | "caution" | "effort";
};

export function lengthCounter(password: string): LengthCounter {
  const n = [...password].length;
  if (n === 0) return { text: "0 of 12", fill: 0, tone: "empty" };
  if (n < MIN_PASSWORD) {
    return {
      text: `${n} of 12 · ${MIN_PASSWORD - n} more`,
      fill: n / MIN_PASSWORD,
      tone: "caution",
    };
  }
  return { text: `✓ ${n} characters`, fill: 1, tone: "effort" };
}

/** The code input keeps digits only, six at most; anything else is dropped. */
export const cleanCode = (input: string): string =>
  input.replace(/\D/g, "").slice(0, CODE_LENGTH);

/** Seconds left of the resend wait, shown as `0:59`. */
export function waitLabel(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Whether asking for a reset code went as far as the screen should say.
 * Cognito answers an address with no account — and one whose email was never
 * verified — with `InvalidParameterException`, even with user-existence
 * errors prevented. Showing that would tell the two apart from a real
 * account, so it reads as sent: step 2 says "If … has an account" for all
 * three (found in I-04's live run).
 */
export const resetCodeSent = (
  outcome: { ok: true } | { ok: false; reason: string },
): boolean => outcome.ok || outcome.reason === "InvalidParameterException";

/** Where an answer from Cognito is shown, and in what words. */
export type Answer = {
  where: "banner" | "email" | "password" | "code";
  tone: "error" | "caution";
  /** The banner's bold lead, if it has one. */
  title?: string;
  text: string;
};

const WRONG_CREDENTIALS: Answer = {
  where: "banner",
  tone: "error",
  title: "Email or password is incorrect.",
  text: "Check both, or reset your password.",
};

const TOO_MANY: Answer = {
  where: "banner",
  tone: "error",
  title: "Too many attempts.",
  text: "Wait a few minutes and try again.",
};

const UNREACHABLE: Answer = {
  where: "banner",
  tone: "error",
  title: "Couldn't reach the sign-in service.",
  text: "Nothing was changed. Try again in a moment.",
};

/**
 * The words for a failed attempt, from the reason `browser.ts` reports.
 * Wrong email and wrong password read the same, so the screen never says
 * which was wrong — or whether the address has an account.
 */
export function answerFor(reason: string): Answer {
  switch (reason) {
    case "NotAuthorizedException":
    case "UserNotFoundException":
      return WRONG_CREDENTIALS;
    case "PasswordAttemptsExceeded":
    case "TooManyRequestsException":
    case "TooManyFailedAttemptsException":
    case "LimitExceededException":
      return TOO_MANY;
    case "UsernameExistsException":
      return {
        where: "email",
        tone: "error",
        text: "An account with this email already exists. Sign in instead.",
      };
    case "CodeMismatchException":
      return {
        where: "code",
        tone: "error",
        text: "That code is wrong. Check the latest email from Keel and try again.",
      };
    case "ExpiredCodeException":
      return {
        where: "banner",
        tone: "caution",
        title: "That code has expired.",
        text: "We've sent a new one. Use the newest email.",
      };
    case "InvalidPasswordException":
      return {
        where: "password",
        tone: "error",
        text: "Enter a password of at least 12 characters.",
      };
    case "exchange_409":
      return {
        where: "banner",
        tone: "error",
        title: "This email belongs to another Keel record.",
        text: "Nothing was created. Ask the operator to reconnect it.",
      };
    default:
      return UNREACHABLE;
  }
}
