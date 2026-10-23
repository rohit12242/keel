"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  answerFor,
  codeError,
  emailError,
  honestyError,
  nameError,
  passwordError,
  waitLabel,
  type Answer,
} from "@/modules/session/domain/authScreens";
import {
  confirmAccount,
  createAccount,
  resendCode,
} from "@/modules/session/browser";
import { carriedHere, carry, dropCarried } from "../carry";
import {
  Banner,
  CodeInput,
  described,
  Field,
  FieldError,
  LengthMeter,
  PasswordInput,
  SubmitButton,
  useFocusWhenIdle,
  useResendWait,
} from "../ui";
import { useToast } from "@/app/toast";
import styles from "../auth.module.css";

type Errors = {
  name?: string;
  email?: React.ReactNode;
  password?: string;
  agree?: string;
  code?: string;
};

/**
 * Create account, then Check your email (02-auth-and-onboarding.md). The two
 * are one page: the password typed here is what confirming signs in with, so
 * it stays in this component's memory and nowhere else. A confirmed account
 * is signed straight in and lands on Today (onboarding comes later).
 */
export function CreateAccountForm() {
  const router = useRouter();
  const carried = carriedHere();
  const [step, setStep] = useState<"create" | "confirm">(
    carried.confirm && carried.password ? "confirm" : "create",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState(carried.email ?? "");
  const [password, setPassword] = useState(carried.password ?? "");
  const [agree, setAgree] = useState(false);
  const [code, setCode] = useState("");
  const [replaceCode, setReplaceCode] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const wait = useResendWait();
  const { show } = useToast();

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const agreeRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const focusWhenIdle = useFocusWhenIdle(busy);

  useEffect(() => dropCarried(), []);

  const toSignIn = () => {
    carry({ email: email.trim() });
    router.push("/sign-in");
  };

  async function sendNewCode() {
    const sent = await resendCode(email.trim());
    if (!sent.ok) {
      setAnswer(answerFor(sent.reason));
      return;
    }
    setCode("");
    setReplaceCode(false);
    setErrors((e) => ({ ...e, code: undefined }));
    wait.start();
    show(`New code sent to ${email.trim()}.`);
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    const next: Errors = {
      name: nameError(name) ?? undefined,
      email: emailError(email, "create_account") ?? undefined,
      password: passwordError(password, "create_account") ?? undefined,
      agree: honestyError(agree) ?? undefined,
    };
    setErrors(next);
    const firstBad = next.name
      ? nameRef
      : next.email
        ? emailRef
        : next.password
          ? passwordRef
          : next.agree
            ? agreeRef
            : null;
    if (firstBad) return firstBad.current?.focus();

    setAnswer(null);
    setBusy(true);
    const created = await createAccount(name.trim(), email.trim(), password);
    setBusy(false);
    if (created.ok) {
      setStep("confirm");
      return;
    }
    const a = answerFor(created.reason);
    if (a.where === "email") {
      setErrors({
        email: (
          <>
            An account with this email already exists.{" "}
            <button
              type="button"
              className={styles.linkButton}
              onClick={toSignIn}
            >
              Sign in instead
            </button>
            .
          </>
        ),
      });
      focusWhenIdle(emailRef);
    } else if (a.where === "password") {
      setErrors({ password: a.text });
      focusWhenIdle(passwordRef);
    } else {
      setAnswer(a);
    }
  }

  async function submitConfirm(e: React.FormEvent) {
    e.preventDefault();
    const bad = codeError(code);
    if (bad) {
      setErrors({ code: bad });
      return codeRef.current?.focus();
    }
    setErrors({});
    setAnswer(null);
    setBusy(true);
    const result = await confirmAccount(email.trim(), password, code);
    if (result.ok) return; // the page is already loading Today
    setBusy(false);
    const a = answerFor(result.reason);
    if (a.where === "code") {
      setErrors({ code: a.text });
      setReplaceCode(true);
      focusWhenIdle(codeRef, true);
    } else if (result.reason === "ExpiredCodeException") {
      setAnswer(a);
      await sendNewCode();
    } else {
      setAnswer(a);
    }
  }

  if (step === "confirm") {
    return (
      <form className={styles.pane} onSubmit={submitConfirm} noValidate>
        <span className={styles.mailIcon} aria-hidden="true">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="1.8" y="3.2" width="12.4" height="9.6" rx="1.6" />
            <path d="M2.2 4l5.8 4.6L13.8 4" />
          </svg>
        </span>
        <div className={styles.paneHead}>
          <h1 className={styles.paneTitle}>Check your email</h1>
          <p className={styles.paneSub}>
            We sent a 6-digit code to <strong>{email.trim()}</strong>. Enter it
            to finish creating your account.
          </p>
        </div>

        {answer ? <Banner answer={answer} /> : null}

        <Field
          id="cf-code"
          label="Code"
          error={errors.code}
          hint={
            <span className={styles.hint} id="cf-hint">
              The code works for 24 hours. Pasting it works too.
            </span>
          }
        >
          <CodeInput
            id="cf-code"
            inputRef={codeRef}
            value={code}
            onChange={(v) => {
              setCode(v);
              setReplaceCode(false);
            }}
            disabled={busy}
            error={errors.code}
            replaceNext={replaceCode}
            describedBy={errors.code ? [] : ["cf-hint"]}
          />
        </Field>

        <SubmitButton
          busy={busy}
          busyLabel="Confirming…"
          disabled={code.length !== 6}
        >
          Confirm email
        </SubmitButton>

        <div className={styles.more}>
          <span aria-live="polite">
            {wait.left > 0 ? (
              <>
                New code sent. You can ask again in{" "}
                <span className={styles.wait}>{waitLabel(wait.left)}</span>.
              </>
            ) : (
              <>
                Didn&rsquo;t get it? Check spam, or{" "}
                <button
                  type="button"
                  className={styles.linkButton}
                  disabled={busy}
                  onClick={() => void sendNewCode()}
                >
                  send a new code
                </button>
                .
              </>
            )}
          </span>
          <button
            type="button"
            className={`${styles.linkButton} ${styles.quiet}`}
            disabled={busy}
            onClick={() => {
              setStep("create");
              setAnswer(null);
              setErrors({});
              setCode("");
            }}
          >
            Wrong email? Go back
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className={styles.pane} onSubmit={submitCreate} noValidate>
      <div className={styles.paneHead}>
        <h1 className={styles.paneTitle}>Create your account</h1>
      </div>

      {answer ? <Banner answer={answer} /> : null}

      <Field id="su-name" label="Name" error={errors.name}>
        <input
          ref={nameRef}
          className={styles.input}
          id="su-name"
          autoComplete="given-name"
          placeholder="Joe"
          value={name}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
          {...described("su-name", errors.name)}
        />
      </Field>

      <Field id="su-email" label="Email" error={errors.email}>
        <input
          ref={emailRef}
          className={styles.input}
          id="su-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          disabled={busy}
          onChange={(e) => setEmail(e.target.value)}
          {...described("su-email", errors.email)}
        />
      </Field>

      <Field
        id="su-pass"
        label="Password"
        error={errors.password}
        hint={
          <span className={styles.hint} id="su-hint">
            At least 12 characters. A short sentence you&rsquo;ll remember works
            well.
          </span>
        }
      >
        <PasswordInput
          id="su-pass"
          inputRef={passwordRef}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder="At least 12 characters"
          disabled={busy}
          error={errors.password}
          describedBy={["su-len", "su-hint"]}
        />
        <LengthMeter id="su-len" password={password} />
      </Field>

      <div className={styles.field}>
        <label className={styles.check} htmlFor="su-agree">
          <input
            ref={agreeRef}
            type="checkbox"
            id="su-agree"
            checked={agree}
            disabled={busy}
            onChange={(e) => setAgree(e.target.checked)}
            {...described("su-agree", errors.agree)}
          />
          <span>
            I understand that Keel records what I actually do, and that it only
            helps if the record is honest.
          </span>
        </label>
        {errors.agree ? (
          <FieldError id="su-agree-error">{errors.agree}</FieldError>
        ) : null}
      </div>

      <SubmitButton busy={busy} busyLabel="Creating your account…">
        Create account
      </SubmitButton>

      <p className={styles.alt}>
        Already have an account?{" "}
        <button
          type="button"
          className={styles.linkButton}
          disabled={busy}
          onClick={toSignIn}
        >
          Sign in
        </button>
      </p>
    </form>
  );
}
