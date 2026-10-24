import styles from "./form.module.css";

/**
 * The app's field pieces (01-shell.md, *Dialogs*): a field's error under it,
 * what a control points at, and a label with its character counter. New
 * objective and Log time share them; the sign-in screens keep their own,
 * which read the auth layout's surfaces (docs/intents/TRIAGE.md).
 */

/** The id a field's error carries: `nf-name-error`. */
export const errorIdOf = (prefix: string, field: string): string =>
  `${prefix}-${field}-error`;

/** What a control needs to point at its error, when it has one, and its hint. */
export const describedBy = (errorId: string | null, ...more: string[]) => ({
  "aria-invalid": errorId ? true : undefined,
  "aria-describedby": [errorId, ...more].filter(Boolean).join(" ") || undefined,
});

/** The alert icon an error carries; a banner uses it too. */
export const AlertIcon = () => (
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

/** A field's error, under it. The icon and the words carry it, not colour alone. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p className={styles.error} id={id}>
      <AlertIcon />
      <span>{message}</span>
    </p>
  );
}

/** A label with its character counter, which turns amber at the limit. */
export function CountedLabel({
  htmlFor,
  label,
  length,
  max,
}: {
  htmlFor: string;
  label: string;
  length: number;
  max: number;
}) {
  return (
    <div className={styles.labelRow}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
      </label>
      <span
        className={`${styles.count} ${length >= max ? styles.countFull : ""}`}
      >
        {length}/{max}
      </span>
    </div>
  );
}
