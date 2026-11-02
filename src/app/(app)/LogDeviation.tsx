"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useToast } from "@/app/toast";
import type { DeviationPattern } from "@/shared/contract";
import {
  beforeCount,
  checkDeviation,
  choicesFor,
  emptyDraft,
  ERRORS,
  fitMinutes,
  LIMITS,
  NEW,
  NO_OBJECTIVE,
  NONE,
  NOT_RECORDED,
  NOT_YET,
  PATTERNS_FAILED,
  patternLabel,
  pickDay,
  TOAST,
  weekChips,
  type DeviationBody,
  type Draft,
  type Field,
  type Pullable,
} from "@/modules/deviations/domain/logDeviation";
import { Dialog, dialogParts as parts } from "./Dialog";
import { CountedLabel, describedBy, errorIdOf, FieldError } from "./form";
import { useShortcut } from "./shortcuts";
import styles from "./logDeviation.module.css";

/**
 * Log a deviation (06-deviations.md). The provider sits on each page that
 * offers it — Deviations, Today — holds whether the dialog is open, and
 * answers `D` there. `LogDeviationButton` opens it from anywhere inside.
 * The rules — the days, the choices, the checks, the bodies — are in
 * `modules/deviations/domain/logDeviation.ts`; this draws them and sends.
 */

type Context = { open: () => void };

const LogContext = createContext<Context>({ open: () => {} });

export function LogDeviationProvider({
  objectives,
  today,
  zone,
  shortcut = true,
  children,
}: {
  /** Every objective the dialog may offer, by `choicesFor`. */
  objectives: readonly Pullable[];
  /** The API's today in the user's zone, and that zone. */
  today: string;
  zone: string;
  /** Whether `D` opens it on this page. */
  shortcut?: boolean;
  children: React.ReactNode;
}) {
  const [opened, setOpened] = useState(false);
  // Held here as well as in the form, so Esc can't close mid-request.
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { show } = useToast();
  const open = () => setOpened(true);

  useShortcut("d", () => {
    if (shortcut) open();
  });

  return (
    <LogContext.Provider value={{ open }}>
      {children}
      <Dialog
        open={opened}
        title="Log a deviation"
        onClose={() => setOpened(false)}
        busy={busy}
      >
        {opened ? (
          <LogDeviationForm
            objectives={objectives}
            today={today}
            zone={zone}
            onClose={() => setOpened(false)}
            onBusy={setBusy}
            onRecorded={(id) => {
              // Every hold cleared, then the page with the new row (01-shell.md).
              setBusy(false);
              setOpened(false);
              show(TOAST);
              router.push(`/deviations/${id}?recorded=1`);
            }}
          />
        ) : null}
      </Dialog>
    </LogContext.Provider>
  );
}

/** A button that opens Log a deviation. */
export function LogDeviationButton({
  className,
  children,
  ...rest
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type">) {
  const { open } = useContext(LogContext);
  return (
    <button type="button" className={className} onClick={open} {...rest}>
      {children}
    </button>
  );
}

type Patterns =
  | { state: "loading" }
  | { state: "failed" }
  | { state: "ready"; list: DeviationPattern[] };

type Errors = Partial<Record<Field, string>>;

const errorId = (f: Field) => errorIdOf("ld", f);

/** A refused or failed send: no body, no answer, or not what was asked. */
async function send(url: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return null;
  }
}

function LogDeviationForm({
  objectives,
  today,
  zone,
  onClose,
  onBusy,
  onRecorded,
}: {
  objectives: readonly Pullable[];
  today: string;
  zone: string;
  onClose: () => void;
  onBusy: (busy: boolean) => void;
  onRecorded: (id: string) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(today));
  const [patterns, setPatterns] = useState<Patterns>({ state: "loading" });
  const [errors, setErrors] = useState<Errors>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusyHere] = useState(false);
  const [shaking, setShaking] = useState(false);
  // Set before the first request, held across both, so a second click or
  // Enter sends nothing.
  const sending = useRef(false);
  const setBusy = (b: boolean) => {
    setBusyHere(b);
    onBusy(b);
  };

  const readPatterns = () =>
    fetch("/v1/deviation-patterns", { credentials: "same-origin" })
      .then(async (res) => {
        if (res.status === 401) return router.push("/sign-in");
        if (!res.ok) throw new Error("unreadable");
        const body = (await res.json()) as { patterns: DeviationPattern[] };
        setPatterns({ state: "ready", list: body.patterns });
      })
      .catch(() => setPatterns({ state: "failed" }));

  // The patterns are read when the dialog opens, never with the page.
  useEffect(() => {
    void readPatterns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = patterns.state === "ready" ? patterns.list : [];
  const choices = choicesFor(objectives, draft.date);
  const days = weekChips(today);

  // An edit clears that field's error, and only that one.
  const clear = (...fields: Field[]) => {
    if (fields.some((f) => errors[f])) {
      setErrors((e) => {
        const next = { ...e };
        for (const f of fields) delete next[f];
        return next;
      });
    }
  };
  const set = <K extends keyof Draft>(
    key: K,
    value: Draft[K],
    field: Field,
  ) => {
    setDraft((d) => ({ ...d, [key]: value }));
    clear(field);
  };

  /** Where focus goes when a field holds the first error. */
  const focusOn = (f: Field) => {
    const ids: Record<Field, string> = {
      kind: "ld-kind-chosen",
      objective: choices.length ? "ld-objective-0" : `ld-day-${draft.date}`,
      what: "ld-what",
      reasoning: "ld-reasoning",
      pattern: "ld-pattern",
      newName: "ld-new-name",
      minutes: "ld-minutes",
      date: `ld-day-${days.find((d) => !d.disabled)?.date}`,
    };
    document.getElementById(ids[f])?.focus();
  };

  const refuse = (next: Errors, first: Field) => {
    setErrors(next);
    setShaking(true);
    focusOn(first);
  };

  /** Free the form for another try, keeping everything typed. */
  const release = () => {
    sending.current = false;
    setBusy(false);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending.current) return;
    const checked = checkDeviation(draft, {
      today,
      tz: zone,
      patterns: list,
      objectives,
    });
    // Without the list, a drift can't name its pattern; a choice still can.
    const unread = draft.kind === "drifted" && patterns.state === "failed";
    if (!checked.ok || unread) {
      const next: Errors = checked.ok ? {} : { ...checked.errors };
      if (unread) next.pattern = PATTERNS_FAILED;
      const first = (checked.ok ? null : checked.first) ?? "pattern";
      refuse(next, first);
      return;
    }
    setErrors({});
    setFailed(null);
    sending.current = true;
    setBusy(true);

    let body: DeviationBody = checked.body;
    if (checked.newPattern) {
      const res = await send("/v1/deviation-patterns", checked.newPattern);
      if (res?.status === 401) {
        onBusy(false);
        router.push("/sign-in");
        return;
      }
      if (res?.status === 409) {
        release();
        void readPatterns();
        refuse({ newName: ERRORS.nameTaken }, "newName");
        return;
      }
      if (res?.status !== 201) {
        release();
        setFailed(NOT_RECORDED);
        return;
      }
      // The pattern stays even if the deviation fails (G36): from here it is
      // picked, so a retry sends only the deviation.
      const made = (await res.json()) as DeviationPattern;
      setPatterns((p) =>
        p.state === "ready" ? { state: "ready", list: [...p.list, made] } : p,
      );
      setDraft((d) => ({
        ...d,
        pattern: made.id,
        newName: "",
        newDescription: "",
      }));
      body = { ...body, pattern_id: made.id };
    }

    const res = await send("/v1/deviations", body);
    if (res?.status === 401) {
      onBusy(false);
      router.push("/sign-in");
      return;
    }
    if (res?.status === 201) {
      const recorded = (await res.json()) as { id: string };
      onRecorded(recorded.id);
      return;
    }
    release();
    setFailed(NOT_RECORDED);
  }

  /** Enter submits from a textarea; Shift+Enter is a new line (01-shell.md). */
  const enterSubmits = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  const fieldClass = (f: Field) =>
    `${styles.field} ${errors[f] ? styles.hasError : ""}`;

  return (
    <form
      className={`${parts.form} ${shaking ? parts.shake : ""}`}
      noValidate
      onSubmit={submit}
      onAnimationEnd={() => setShaking(false)}
      aria-busy={busy || undefined}
    >
      <div className={parts.body}>
        {failed ? (
          <p className={styles.banner} role="alert">
            {failed}
          </p>
        ) : null}

        <fieldset
          className={fieldClass("kind")}
          aria-describedby={errors.kind ? errorId("kind") : undefined}
        >
          <legend className={styles.label}>Which kind</legend>
          <div className={styles.kinds}>
            {(
              [
                [
                  "chosen",
                  "Chosen",
                  "I decided to go off, with a reason. Something was urgent or genuinely worth it.",
                ],
                [
                  "drifted",
                  "Drifted",
                  "It happened to me. I noticed afterwards.",
                ],
              ] as const
            ).map(([kind, name, text]) => (
              <label key={kind} className={styles.kind}>
                <input
                  id={`ld-kind-${kind}`}
                  className={styles.radio}
                  type="radio"
                  name="ld-kind"
                  checked={draft.kind === kind}
                  data-autofocus={kind === "chosen" || undefined}
                  onChange={() => {
                    setDraft((d) => ({ ...d, kind }));
                    clear("kind", "reasoning", "pattern", "newName");
                  }}
                />
                <b>{name}</b>
                <span>{text}</span>
              </label>
            ))}
          </div>
          <FieldError id={errorId("kind")} message={errors.kind} />
        </fieldset>

        <fieldset
          className={fieldClass("objective")}
          aria-describedby={errors.objective ? errorId("objective") : undefined}
        >
          <legend className={styles.label}>Pulled you away from</legend>
          {choices.length === 0 ? (
            <p className={styles.hint}>{NO_OBJECTIVE}</p>
          ) : (
            <div className={styles.chips}>
              {choices.map((o, i) => (
                <label key={o.id} className={styles.chip}>
                  <input
                    id={`ld-objective-${i}`}
                    className={styles.radio}
                    type="radio"
                    name="ld-objective"
                    checked={draft.objectiveId === o.id}
                    onChange={() => set("objectiveId", o.id, "objective")}
                  />
                  <span className={styles.chipText}>{o.title}</span>
                </label>
              ))}
            </div>
          )}
          <FieldError id={errorId("objective")} message={errors.objective} />
        </fieldset>

        <div className={fieldClass("what")}>
          <CountedLabel
            htmlFor="ld-what"
            label="What happened"
            length={draft.what.length}
            max={LIMITS.what}
          />
          <textarea
            id="ld-what"
            className={styles.textarea}
            maxLength={LIMITS.what}
            placeholder="One or two sentences, in your own words."
            value={draft.what}
            onChange={(e) => set("what", e.target.value, "what")}
            onKeyDown={enterSubmits}
            {...describedBy(errors.what ? errorId("what") : null)}
          />
          <FieldError id={errorId("what")} message={errors.what} />
        </div>

        {draft.kind === "chosen" ? (
          <div className={fieldClass("reasoning")}>
            <CountedLabel
              htmlFor="ld-reasoning"
              label="Your reasoning"
              length={draft.reasoning.length}
              max={LIMITS.reasoning}
            />
            <textarea
              id="ld-reasoning"
              className={styles.textarea}
              maxLength={LIMITS.reasoning}
              value={draft.reasoning}
              onChange={(e) => set("reasoning", e.target.value, "reasoning")}
              onKeyDown={enterSubmits}
              {...describedBy(
                errors.reasoning ? errorId("reasoning") : null,
                "ld-reasoning-hint",
              )}
            />
            <span className={styles.hint} id="ld-reasoning-hint">
              Recorded now, tested at review. You&rsquo;ll mark whether it held.
            </span>
            <FieldError id={errorId("reasoning")} message={errors.reasoning} />
          </div>
        ) : null}

        {draft.kind === "drifted" ? (
          <div className={fieldClass("pattern")}>
            <span className={styles.label} id="ld-pattern-label">
              Pattern
            </span>
            <PatternPicker
              patterns={patterns}
              value={draft.pattern}
              invalid={!!errors.pattern}
              onPick={(p) => {
                setDraft((d) => ({ ...d, pattern: p }));
                clear("pattern", "newName");
              }}
            />
            <span className={styles.hint} id="ld-pattern-hint">
              Pick the closest. Naming the pattern is how repeats become
              visible.
            </span>
            <FieldError id={errorId("pattern")} message={errors.pattern} />
          </div>
        ) : null}

        {draft.kind === "drifted" && draft.pattern === NEW ? (
          <div className={styles.newPattern}>
            <div className={fieldClass("newName")}>
              <CountedLabel
                htmlFor="ld-new-name"
                label="Name it"
                length={draft.newName.length}
                max={LIMITS.name}
              />
              <input
                id="ld-new-name"
                className={styles.input}
                autoComplete="off"
                maxLength={LIMITS.name}
                placeholder="e.g. Research spiral"
                value={draft.newName}
                onChange={(e) => set("newName", e.target.value, "newName")}
                {...describedBy(errors.newName ? errorId("newName") : null)}
              />
              <FieldError id={errorId("newName")} message={errors.newName} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="ld-new-description">
                What it looks like{" "}
                <span className={styles.opt}>· optional</span>
              </label>
              <input
                id="ld-new-description"
                className={styles.input}
                autoComplete="off"
                maxLength={LIMITS.description}
                placeholder="e.g. Reading one more source instead of starting."
                value={draft.newDescription}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, newDescription: e.target.value }))
                }
              />
            </div>
            <span className={styles.hint}>
              It joins your pattern list when you record this deviation.
            </span>
          </div>
        ) : null}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="ld-instead">
            What you did instead <span className={styles.opt}>· optional</span>
          </label>
          <input
            id="ld-instead"
            className={styles.input}
            autoComplete="off"
            maxLength={LIMITS.instead}
            placeholder="Helps when you read it back."
            value={draft.instead}
            onChange={(e) =>
              setDraft((d) => ({ ...d, instead: e.target.value }))
            }
          />
        </div>

        <div className={fieldClass("minutes")}>
          <label className={styles.label} htmlFor="ld-minutes">
            Minutes
          </label>
          <input
            id="ld-minutes"
            className={`${styles.input} ${styles.minutes}`}
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder="e.g. 90"
            value={draft.minutes}
            onChange={(e) =>
              set("minutes", fitMinutes(e.target.value), "minutes")
            }
            {...describedBy(errors.minutes ? errorId("minutes") : null)}
          />
          <FieldError id={errorId("minutes")} message={errors.minutes} />
        </div>

        <fieldset
          className={fieldClass("date")}
          aria-describedby={errors.date ? errorId("date") : undefined}
        >
          <legend className={styles.label}>When</legend>
          <div className={styles.days}>
            {days.map((d) => (
              <label
                key={d.date}
                className={`${styles.chip} ${styles.day}`}
                title={d.disabled ? NOT_YET : undefined}
              >
                <input
                  id={`ld-day-${d.date}`}
                  className={styles.radio}
                  type="radio"
                  name="ld-day"
                  aria-label={d.disabled ? `${d.name}, ${NOT_YET}` : d.name}
                  checked={draft.date === d.date}
                  disabled={d.disabled}
                  onChange={() => {
                    setDraft((x) => pickDay(x, d.date, objectives));
                    clear("date", "objective");
                  }}
                />
                <span aria-hidden="true">{d.label}</span>
              </label>
            ))}
          </div>
          <FieldError id={errorId("date")} message={errors.date} />
        </fieldset>
      </div>

      <div className={parts.foot}>
        <div className={parts.start}>
          <span className={parts.keys}>
            Once recorded, it can&rsquo;t be edited or deleted.
          </span>
        </div>
        <div className={parts.actions}>
          <button
            type="button"
            className={parts.muted}
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={parts.primary}
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {busy ? "Recording…" : "Record deviation"}
          </button>
        </div>
      </div>
    </form>
  );
}

type Option = {
  value: string;
  name: string;
  description: string | null;
  before: string | null;
};

/**
 * The pattern dropdown: a select-only combobox (WAI-ARIA APG). Focus stays
 * on the button; ↑ ↓ Home End move the active option, Enter or Space picks
 * it, Esc closes the list without closing the dialog, Tab closes it.
 */
function PatternPicker({
  patterns,
  value,
  invalid,
  onPick,
}: {
  patterns: Patterns;
  value: string | null;
  invalid: boolean;
  onPick: (value: string) => void;
}) {
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);

  const list = patterns.state === "ready" ? patterns.list : [];
  const options: Option[] = [
    ...list.map((p) => ({
      value: p.id,
      name: p.name,
      description: p.description,
      before: beforeCount(p.occurrences),
    })),
    {
      value: NONE,
      name: "None of these",
      description: "A genuine one-off, not a shape I recognise.",
      before: null,
    },
    {
      value: NEW,
      name: "+ Add a new pattern",
      description: null,
      before: null,
    },
  ];
  const optionId = (i: number) => `${listId}-${i}`;
  const label = patternLabel(value, list);

  // A click outside closes the list.
  useEffect(() => {
    if (!expanded) return;
    const away = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setExpanded(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [expanded]);

  const openList = () => {
    const at = options.findIndex((o) => o.value === value);
    setActive(at >= 0 ? at : 0);
    setExpanded(true);
  };
  const pick = (i: number) => {
    setExpanded(false);
    onPick(options[i].value);
    if (options[i].value === NEW) {
      setTimeout(() => document.getElementById("ld-new-name")?.focus(), 0);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!expanded) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    const last = options.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(active + 1, last),
      ArrowUp: Math.max(active - 1, 0),
      Home: 0,
      End: last,
    };
    if (e.key in moves) {
      e.preventDefault();
      setActive(moves[e.key]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Escape") {
      // The list closes; the dialog stays open.
      e.preventDefault();
      e.stopPropagation();
      setExpanded(false);
    } else if (e.key === "Tab") {
      setExpanded(false);
    }
  };

  if (patterns.state === "loading") {
    return (
      <button type="button" className={styles.select} disabled>
        <span className={styles.placeholder}>Loading your patterns…</span>
      </button>
    );
  }
  if (patterns.state === "failed") {
    return <p className={styles.hint}>{PATTERNS_FAILED}</p>;
  }

  return (
    <div className={styles.selectWrap} ref={wrap}>
      <button
        type="button"
        id="ld-pattern"
        role="combobox"
        className={styles.select}
        aria-haspopup="listbox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-labelledby="ld-pattern-label ld-pattern-value"
        aria-describedby={
          invalid ? `${errorId("pattern")} ld-pattern-hint` : "ld-pattern-hint"
        }
        aria-invalid={invalid || undefined}
        aria-activedescendant={expanded ? optionId(active) : undefined}
        onClick={() => (expanded ? setExpanded(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span
          id="ld-pattern-value"
          className={label ? undefined : styles.placeholder}
        >
          {label ?? "Pick the closest"}
        </span>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      <ul
        id={listId}
        role="listbox"
        aria-labelledby="ld-pattern-label"
        className={styles.menu}
        hidden={!expanded}
      >
        {options.map((o, i) => (
          <li
            key={o.value}
            id={optionId(i)}
            role="option"
            aria-selected={o.value === value}
            className={`${o.value === NEW ? styles.addOption : styles.option} ${
              i === active ? styles.active : ""
            }`}
            // Keep focus on the button while the mouse picks.
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(i)}
            onClick={() => pick(i)}
          >
            <span>
              <b>{o.name}</b>
              {o.description ? <small>{o.description}</small> : null}
            </span>
            {o.before ? (
              <span className={styles.before}>{o.before}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
