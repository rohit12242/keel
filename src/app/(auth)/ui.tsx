"use client";

import { useEffect, useRef, useState } from "react";
import {
  CODE_LENGTH,
  cleanCode,
  lengthCounter,
  RESEND_WAIT_SECONDS,
  type Answer,
} from "@/modules/session/domain/authScreens";
import styles from "./auth.module.css";

/**
 * The pieces every sign-in screen is built from. They draw; the rules —
 * what an error says, what the counter reads — are in
 * `modules/session/domain/authScreens.ts`.
 */

const AlertIcon = () => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="8" cy="8" r="6.2" />
    <path d="M8 4.8v3.8M8 11v.1" />
  </svg>
);

export const InfoIcon = () => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="8" cy="8" r="6" />
    <path d="M8 7.2v3.6M8 5.2v.1" />
  </svg>
);

/** A field's error, under it. The icon and the words carry it, not colour alone. */
export function FieldError({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <p className={styles.error} id={id}>
      <AlertIcon />
      <span>{children}</span>
    </p>
  );
}

/** A labelled field: its control, then its hint or its error. */
export function Field({
  id,
  label,
  error,
  aside,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: React.ReactNode;
  aside?: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`${styles.field} ${error ? styles.hasError : ""}`}>
      {aside ? (
        <div className={styles.fieldRow}>
          <label className={styles.label} htmlFor={id}>
            {label}
          </label>
          {aside}
        </div>
      ) : (
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
      )}
      {children}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : hint}
    </div>
  );
}

/** What a field's control needs to point at its hint and error. */
export const described = (id: string, error: unknown, ...more: string[]) => ({
  "aria-invalid": error ? true : undefined,
  "aria-describedby":
    [error ? `${id}-error` : null, ...more].filter(Boolean).join(" ") ||
    undefined,
});

/** A password input with its Show toggle. */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
  disabled,
  error,
  describedBy = [],
  inputRef,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  placeholder: string;
  disabled: boolean;
  error: unknown;
  describedBy?: string[];
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className={styles.pw}>
      <input
        ref={inputRef}
        className={styles.input}
        id={id}
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        {...described(id, error, ...describedBy)}
      />
      <button
        type="button"
        className={styles.pwToggle}
        aria-pressed={shown}
        aria-label={shown ? "Hide password" : "Show password"}
        disabled={disabled}
        onClick={() => setShown((s) => !s)}
      >
        {shown ? "Hide" : "Show"}
      </button>
    </div>
  );
}

/** The length counter under a new password: a bar and words, never colour alone. */
export function LengthMeter({
  id,
  password,
}: {
  id: string;
  password: string;
}) {
  const c = lengthCounter(password);
  const tone =
    c.tone === "effort"
      ? styles.lenEffort
      : c.tone === "caution"
        ? styles.lenCaution
        : "";
  return (
    <div className={`${styles.len} ${tone}`} id={id}>
      <span className={styles.lenBar} aria-hidden="true">
        <i style={{ width: `${c.fill * 100}%` }} />
      </span>
      <span className={styles.lenN} aria-live="polite">
        {c.text}
      </span>
    </div>
  );
}

/**
 * The six code boxes: one numeric input the boxes only draw. Anything but
 * digits is dropped; after a wrong code, the first keystroke replaces the
 * whole code.
 */
export function CodeInput({
  id,
  value,
  onChange,
  disabled,
  error,
  replaceNext,
  describedBy = [],
  inputRef,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  error: unknown;
  replaceNext: boolean;
  describedBy?: string[];
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const [focused, setFocused] = useState(false);
  const at = Math.min(value.length, CODE_LENGTH - 1);
  return (
    <div className={`${styles.code} ${focused ? styles.codeFocus : ""}`}>
      {Array.from({ length: CODE_LENGTH }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`${styles.cell} ${i === at ? styles.cellOn : ""}`}
        >
          {value[i] ??
            (focused && i === value.length ? (
              <span className={styles.caret} />
            ) : null)}
        </span>
      ))}
      <input
        ref={inputRef}
        className={styles.codeInput}
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        value={value}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const next = e.target.value;
          // After a wrong code, what is typed or pasted replaces it whole.
          const typed =
            replaceNext && next.startsWith(value)
              ? next.slice(value.length)
              : next;
          onChange(cleanCode(typed));
        }}
        {...described(id, error, ...describedBy)}
      />
    </div>
  );
}

/** Cognito's answer above the fields: a red or amber banner, bold lead first. */
export function Banner({
  answer,
  children,
}: {
  answer: Answer;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`${styles.banner} ${answer.tone === "caution" ? styles.bannerCaution : ""}`}
      role="alert"
    >
      <AlertIcon />
      <span>
        {answer.title ? <b>{answer.title}</b> : null} {children ?? answer.text}
      </span>
    </div>
  );
}

/** The primary button; busy, it spins and names what it is doing. */
export function SubmitButton({
  busy,
  busyLabel,
  disabled,
  children,
}: {
  busy: boolean;
  busyLabel: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      className={styles.button}
      type="submit"
      disabled={busy || disabled}
      aria-busy={busy || undefined}
    >
      {busy ? (
        <>
          <span className={styles.spin} aria-hidden="true" />
          {busyLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * The wait after "Send a new code": seconds left, counting down once a
 * second, and how to start it again.
 */
export function useResendWait(): { left: number; start: () => void } {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return { left, start: () => setLeft(RESEND_WAIT_SECONDS) };
}

/**
 * Focus a field once the form is no longer busy. While an answer from
 * Cognito is awaited every field is disabled, and a disabled field cannot
 * take the focus; this waits for the render that enables it again.
 */
export function useFocusWhenIdle(busy: boolean) {
  const pending = useRef<{
    field: React.RefObject<HTMLInputElement | null>;
    select: boolean;
  } | null>(null);
  useEffect(() => {
    if (busy || !pending.current) return;
    const { field, select } = pending.current;
    pending.current = null;
    if (select) field.current?.select();
    else field.current?.focus();
  }, [busy]);
  return (field: React.RefObject<HTMLInputElement | null>, select = false) => {
    pending.current = { field, select };
  };
}
