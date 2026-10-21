"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  answerFor,
  codeError,
  emailError,
  passwordError,
  waitLabel,
  type Answer,
} from "@/modules/session/domain/authScreens";
import { finishReset, startReset } from "@/modules/session/browser";
import { carriedHere, carry, dropCarried } from "../carry";
import {
  Banner,
  CodeInput,
  described,
  Field,
  InfoIcon,
  LengthMeter,
  PasswordInput,
  SubmitButton,
  useResendWait,
  useToast,
} from "../ui";
import styles from "../auth.module.css";

/** Where a finished reset lands: Today, which then says so (`src/app/page.tsx`). */
const AFTER_RESET = "/?reset=done";

/**
 * Reset your password, in two steps (02-auth-and-onboarding.md). Step 1
 * never says whether the email has an account; step 2's "If … has an
 * account" covers both. A good code and new password sign straight in,
 * through the same exchange as Sign in.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState(() => carriedHere().email ?? "");
  const [code, setCode] = useState("");
  const [replaceCode, setReplaceCode] = useState(false);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{
    email?: string;
    code?: string;
    password?: string;
  }>({});
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const wait = useResendWait();
  const { toast, show } = useToast();
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => dropCarried(), []);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    const bad = emailError(email, "reset");
    setErrors({ email: bad ?? undefined });
    if (bad) return emailRef.current?.focus();

    setAnswer(null);
    setBusy(true);
    const sent = await startReset(email.trim());
    setBusy(false);
    if (!sent.ok) {
      setAnswer(answerFor(sent.reason));
      return;
    }
    setStep(2);
  }

  async function sendNewCode() {
    const sent = await startReset(email.trim());
    if (!sent.ok) {
      setAnswer(answerFor(sent.reason));
      return false;
    }
    setCode("");
    setReplaceCode(false);
    wait.start();
    show(`New code sent to ${email.trim()}.`);
    return true;
  }

  async function submitNewPassword(e: React.FormEvent) {
    e.preventDefault();
    const next = {
      code: codeError(code) ?? undefined,
      password: passwordError(password, "reset") ?? undefined,
    };
    setErrors(next);
    if (next.code) return codeRef.current?.focus();
    if (next.password) return passwordRef.current?.focus();

    setAnswer(null);
    setBusy(true);
    const result = await finishReset(email.trim(), code, password, AFTER_RESET);
    if (result.ok) return; // the page is already loading Today
    setBusy(false);

    if (result.reason === "ExpiredCodeException") {
      // A new code goes out at once; the banner says to use the newest email.
      setAnswer(answerFor(result.reason));
      await sendNewCode();
      codeRef.current?.focus();
      return;
    }
    const a = answerFor(result.reason);
    if (a.where === "code") {
      setErrors({ code: a.text });
      setReplaceCode(true);
      setTimeout(() => codeRef.current?.select(), 0);
    } else if (a.where === "password") {
      setErrors({ password: a.text });
      passwordRef.current?.focus();
    } else {
      setAnswer(a);
    }
  }

  if (step === 2) {
    return (
      <form className={styles.pane} onSubmit={submitNewPassword} noValidate>
        <div className={styles.paneHead}>
          <span className={styles.step}>Step 2 of 2</span>
          <h1 className={styles.paneTitle}>Set a new password</h1>
          <p className={styles.paneSub}>
            If <strong>{email.trim()}</strong> has an account, a 6-digit code is
            on its way. It expires in an hour.
          </p>
        </div>

        {answer ? <Banner answer={answer} /> : null}

        <Field
          id="r2-code"
          label="Code"
          error={errors.code}
          aside={
            <span aria-live="polite">
              {wait.left > 0 ? (
                <span className={styles.wait}>
                  new code in {waitLabel(wait.left)}
                </span>
              ) : (
                <button
                  type="button"
                  className={styles.linkButton}
                  disabled={busy}
                  onClick={() => void sendNewCode()}
                >
                  Send a new code
                </button>
              )}
            </span>
          }
        >
          <CodeInput
            id="r2-code"
            inputRef={codeRef}
            value={code}
            onChange={(v) => {
              setCode(v);
              setReplaceCode(false);
            }}
            disabled={busy}
            error={errors.code}
            replaceNext={replaceCode}
          />
        </Field>

        <Field id="r2-pass" label="New password" error={errors.password}>
          <PasswordInput
            id="r2-pass"
            inputRef={passwordRef}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            placeholder="At least 12 characters"
            disabled={busy}
            error={errors.password}
            describedBy={["r2-len"]}
          />
          <LengthMeter id="r2-len" password={password} />
        </Field>

        <SubmitButton busy={busy} busyLabel="Saving…">
          Save password and sign in
        </SubmitButton>

        <p className={styles.alt}>
          Wrong email?{" "}
          <button
            type="button"
            className={styles.linkButton}
            disabled={busy}
            onClick={() => {
              setStep(1);
              setAnswer(null);
              setErrors({});
              setCode("");
              setPassword("");
            }}
          >
            Start again
          </button>
        </p>
        {toast}
      </form>
    );
  }

  return (
    <form className={styles.pane} onSubmit={submitEmail} noValidate>
      <div className={styles.paneHead}>
        <span className={styles.step}>Step 1 of 2</span>
        <h1 className={styles.paneTitle}>Reset your password</h1>
        <p className={styles.paneSub}>
          Enter the email you signed up with. We&rsquo;ll send you a 6-digit
          code.
        </p>
      </div>

      {answer ? <Banner answer={answer} /> : null}

      <Field id="rs-email" label="Email" error={errors.email}>
        <input
          ref={emailRef}
          className={styles.input}
          id="rs-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          disabled={busy}
          onChange={(e) => setEmail(e.target.value)}
          {...described("rs-email", errors.email)}
        />
      </Field>

      <SubmitButton busy={busy} busyLabel="Sending…">
        Send code
      </SubmitButton>

      <div className={styles.note}>
        <InfoIcon />
        <span>The code works once and expires after an hour.</span>
      </div>

      <p className={styles.alt}>
        Remembered it?{" "}
        <button
          type="button"
          className={styles.linkButton}
          disabled={busy}
          onClick={() => {
            carry({ email: email.trim() });
            router.push("/sign-in");
          }}
        >
          Back to sign in
        </button>
      </p>
    </form>
  );
}
