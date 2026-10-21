"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  answerFor,
  emailError,
  passwordError,
  type Answer,
} from "@/modules/session/domain/authScreens";
import { signInToKeel } from "@/modules/session/browser";
import { carriedHere, carry, dropCarried } from "../carry";
import {
  Banner,
  described,
  Field,
  PasswordInput,
  SubmitButton,
  useFocusWhenIdle,
} from "../ui";
import styles from "../auth.module.css";

/**
 * Sign in (02-auth-and-onboarding.md). A wrong email or password reads the
 * same; the email stays, the password empties and takes the focus.
 */
export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState(() => carriedHere().email ?? "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const focusWhenIdle = useFocusWhenIdle(busy);

  useEffect(() => dropCarried(), []);

  /** "Forgot password?" and "reset your password" bring the email along. */
  const toReset = () => {
    carry({ email: email.trim() });
    router.push("/reset-password");
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = {
      email: emailError(email, "sign_in") ?? undefined,
      password: passwordError(password, "sign_in") ?? undefined,
    };
    setErrors(next);
    if (next.email) return emailRef.current?.focus();
    if (next.password) return passwordRef.current?.focus();

    setAnswer(null);
    setBusy(true);
    const result = await signInToKeel(email.trim(), password);
    if (result.ok) return; // the page is already loading Today

    if (result.reason === "not_confirmed") {
      // The account exists but its email was never confirmed: finish that,
      // then sign in with the password just typed.
      carry({ email: email.trim(), password, confirm: true });
      router.push("/create-account");
      return;
    }
    setBusy(false);
    setAnswer(answerFor(result.reason));
    setPassword("");
    focusWhenIdle(passwordRef);
  }

  return (
    <form className={styles.pane} onSubmit={submit} noValidate>
      <div className={styles.paneHead}>
        <h1 className={styles.paneTitle}>Sign in</h1>
        <p className={styles.paneSub}>Welcome back.</p>
      </div>

      {answer ? (
        <Banner answer={answer}>
          {answer.title === "Email or password is incorrect." ? (
            <>
              Check both, or{" "}
              <button
                type="button"
                className={styles.linkButton}
                onClick={toReset}
              >
                reset your password
              </button>
              .
            </>
          ) : undefined}
        </Banner>
      ) : null}

      <Field id="si-email" label="Email" error={errors.email}>
        <input
          ref={emailRef}
          className={styles.input}
          id="si-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          disabled={busy}
          onChange={(e) => setEmail(e.target.value)}
          {...described("si-email", errors.email)}
        />
      </Field>

      <Field
        id="si-pass"
        label="Password"
        error={errors.password}
        aside={
          <button
            type="button"
            className={styles.linkButton}
            disabled={busy}
            onClick={toReset}
          >
            Forgot password?
          </button>
        }
      >
        <PasswordInput
          id="si-pass"
          inputRef={passwordRef}
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="Your password"
          disabled={busy}
          error={errors.password}
        />
      </Field>

      <SubmitButton busy={busy} busyLabel="Signing in…">
        Sign in
      </SubmitButton>

      <p className={styles.alt}>
        No account yet?{" "}
        <button
          type="button"
          className={styles.linkButton}
          disabled={busy}
          onClick={() => {
            carry({ email: email.trim() });
            router.push("/create-account");
          }}
        >
          Create one
        </button>
      </p>
    </form>
  );
}
