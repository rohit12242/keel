import { describe, expect, it } from "vitest";
import {
  answerFor,
  cleanCode,
  codeError,
  emailError,
  honestyError,
  lengthCounter,
  nameError,
  passwordError,
  RESEND_WAIT_SECONDS,
  resetCodeSent,
  waitLabel,
} from "./authScreens";

describe("emailError", () => {
  it("asks for the email on the account when signing in or resetting", () => {
    expect(emailError("", "sign_in")).toBe("Enter the email on your account.");
    expect(emailError("  ", "reset")).toBe("Enter the email on your account.");
  });

  it("asks for an email, with an example, on Create account", () => {
    expect(emailError("", "create_account")).toBe(
      "Enter your email, like you@example.com.",
    );
  });

  it("needs an @ and a domain", () => {
    for (const bad of [
      "rohit",
      "rohit@",
      "rohit@example",
      "a b@example.com",
      "rohit@example.com,",
      "rohit@example.com;",
      "rohit,x@example.com",
      "rohit@-example.com",
      "rohit@example..com",
    ]) {
      expect(emailError(bad, "sign_in")).toBe(
        "Check the email: it needs an @ and a domain, like you@example.com.",
      );
    }
    expect(emailError(" rohit@example.com ", "sign_in")).toBeNull();
    expect(emailError("rohit.y+test@mail.example.co.uk", "reset")).toBeNull();
  });
});

describe("passwordError", () => {
  it("signing in only needs a password, of any length", () => {
    expect(passwordError("", "sign_in")).toBe("Enter your password.");
    expect(passwordError("short", "sign_in")).toBeNull();
  });

  it("a new password needs 12 characters, and says how many more", () => {
    expect(passwordError("", "create_account")).toBe(
      "Enter a password of at least 12 characters.",
    );
    expect(passwordError("", "reset")).toBe(
      "Enter a new password of at least 12 characters.",
    );
    expect(passwordError("nine char", "create_account")).toBe(
      "Use at least 12 characters. 3 more to go.",
    );
    expect(passwordError("twelve chars", "reset")).toBeNull();
  });

  it("counts characters, not UTF-16 units", () => {
    expect(passwordError("🙂".repeat(12), "create_account")).toBeNull();
  });
});

describe("the other fields", () => {
  it("name, honesty box and code each have their message", () => {
    expect(nameError(" ")).toBe("Enter your name. Only you will see it.");
    expect(nameError("Joe")).toBeNull();
    expect(honestyError(false)).toBe("Tick this to continue.");
    expect(honestyError(true)).toBeNull();
    expect(codeError("12345")).toBe("Enter the 6-digit code from the email.");
    expect(codeError("123456")).toBeNull();
  });
});

describe("lengthCounter", () => {
  it("reads as the design shows it, empty, short and long enough", () => {
    expect(lengthCounter("")).toEqual({
      text: "0 of 12",
      fill: 0,
      tone: "empty",
    });
    expect(lengthCounter("123456789")).toEqual({
      text: "9 of 12 · 3 more",
      fill: 0.75,
      tone: "caution",
    });
    expect(lengthCounter("x".repeat(20))).toEqual({
      text: "✓ 20 characters",
      fill: 1,
      tone: "effort",
    });
  });
});

describe("cleanCode", () => {
  it("keeps digits only, six at most", () => {
    expect(cleanCode("12a3 4-5")).toBe("12345");
    expect(cleanCode("123 456 789")).toBe("123456");
    expect(cleanCode("abc")).toBe("");
  });
});

describe("waitLabel", () => {
  it("counts the minute down as m:ss", () => {
    expect(RESEND_WAIT_SECONDS).toBe(60);
    expect(waitLabel(59)).toBe("0:59");
    expect(waitLabel(60)).toBe("1:00");
    expect(waitLabel(4.2)).toBe("0:05");
    expect(waitLabel(-3)).toBe("0:00");
  });
});

describe("resetCodeSent", () => {
  it("reads the same for an account, no account, and an unverified one", () => {
    expect(resetCodeSent({ ok: true })).toBe(true);
    expect(
      resetCodeSent({ ok: false, reason: "InvalidParameterException" }),
    ).toBe(true);
  });

  it("but not when Cognito could not be asked, or refused for too many tries", () => {
    for (const reason of ["LimitExceededException", "NetworkError"]) {
      expect(resetCodeSent({ ok: false, reason })).toBe(false);
    }
  });
});

describe("answerFor", () => {
  it("never says whether the email or the password was wrong", () => {
    expect(answerFor("UserNotFoundException")).toEqual(
      answerFor("NotAuthorizedException"),
    );
    expect(answerFor("NotAuthorizedException")).toEqual({
      where: "banner",
      tone: "error",
      title: "Email or password is incorrect.",
      text: "Check both, or reset your password.",
    });
  });

  it("too many attempts, however Cognito says it", () => {
    for (const r of [
      "PasswordAttemptsExceeded",
      "TooManyRequestsException",
      "TooManyFailedAttemptsException",
      "LimitExceededException",
    ]) {
      expect(answerFor(r)).toMatchObject({ title: "Too many attempts." });
    }
  });

  it("puts each other answer where the design does", () => {
    expect(answerFor("UsernameExistsException")).toMatchObject({
      where: "email",
      text: "An account with this email already exists. Sign in instead.",
    });
    expect(answerFor("CodeMismatchException")).toMatchObject({
      where: "code",
      text: "That code is wrong. Check the latest email from Keel and try again.",
    });
    expect(answerFor("ExpiredCodeException")).toMatchObject({
      where: "banner",
      tone: "caution",
      title: "That code has expired.",
    });
    expect(answerFor("InvalidPasswordException")).toMatchObject({
      where: "password",
    });
    expect(answerFor("exchange_409")).toMatchObject({ where: "banner" });
  });

  it("anything else is an unreachable service, never a blank", () => {
    for (const r of ["NetworkError", "exchange_503", "Unknown"]) {
      expect(answerFor(r)).toMatchObject({
        title: "Couldn't reach the sign-in service.",
      });
    }
  });
});
