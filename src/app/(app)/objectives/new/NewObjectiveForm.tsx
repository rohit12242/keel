"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BackIcon } from "@/app/icons";
import { useBrowserDay } from "@/app/browserDay";
import { useToast } from "@/app/toast";
import type { Objective, ParkedIdea } from "@/shared/contract";
import {
  checkStart,
  fillFrom,
  NO_LONGER_APPROVED,
  type Origin,
} from "@/modules/parking/domain/startFrom";
import {
  checkDraft,
  createdMessage,
  dayLabel,
  DEFAULT_DRAFT,
  NAME_MAX,
  preview,
  startChoices,
  TEXT_MAX,
  type Draft,
  type Field,
  type StartChoice,
} from "@/modules/objectives/domain/newObjective";
import {
  AlertIcon,
  CountedLabel,
  describedBy,
  errorIdOf,
  FieldError as SharedFieldError,
} from "../../form";
import { RadioGroup } from "./RadioGroup";
import { StartFrom, type Approved } from "./StartFrom";
import styles from "./newObjective.module.css";

/**
 * The New objective page (04-objectives.md): "Start from" when it is given
 * the approved ideas, What it is, Schedule, Plan with its preview, and the
 * sticky footer. The rules —
 * the Start dates, the preview, the checks — are in
 * `modules/objectives/domain/newObjective.ts`; this draws them.
 *
 * Onboarding's step 2 is this form (I-10), so it takes options. With none,
 * it is New objective: its own draft, Cancel, and the objective after
 * Create.
 */

/** The weekday chips, Monday first; Extend uses them too (I-14). */
export const WEEKDAYS: [number, string][] = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [7, "Sun"],
];

export const onlyDigits = (s: string) => s.replace(/\D/g, "");

/** The checks an edit to each part of the draft can change. */
const AFFECTS: Record<keyof Draft, Field[]> = {
  name: ["name"],
  why: ["why"],
  criteria: ["criteria"],
  weekdays: ["days"],
  hours: ["target"],
  minutes: ["target"],
  start: [],
  length: ["length"],
  unit: ["length"],
  cadence: [],
};

/** Where focus goes when a field holds the first error. */
const FOCUS: Record<Field, string> = {
  name: "nf-name",
  why: "nf-why",
  criteria: "nf-criteria",
  days: "nf-day-1",
  target: "nf-hours",
  length: "nf-length",
};

type Errors = Partial<Record<Field, string>>;

const errorId = (f: Field) => errorIdOf("nf", f);

/** What a control needs to point at its error, and its hint. */
const described = (field: Field, errors: Errors, ...more: string[]) =>
  describedBy(errors[field] ? errorId(field) : null, ...more);

const FieldError = ({ field, errors }: { field: Field; errors: Errors }) => (
  <SharedFieldError id={errorId(field)} message={errors[field]} />
);

/** Two or more buttons, one pressed. */
export function Segments<T extends string>({
  label,
  labelledBy,
  options,
  value,
  onChange,
}: {
  label?: string;
  labelledBy?: string;
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      aria-labelledby={labelledBy}
      className={styles.seg}
    >
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          className={styles.segBtn}
          aria-pressed={v === value}
          onClick={() => onChange(v)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export type FormOptions = {
  /** A draft the caller holds, so it outlives the form (Back, then Next). */
  held?: [Draft, React.Dispatch<React.SetStateAction<Draft>>];
  /** After a 201, in place of the toast and Today. */
  onCreated?: (objective: Objective, today: string) => void;
  /** The control left of Create, in place of Cancel. */
  back?: React.ReactNode;
  /** Under the success criteria's hint. */
  criteriaExtra?: React.ReactNode;
  /**
   * The approved ideas New objective may start from (I-16). Without it —
   * onboarding — there is no "Start from" card.
   */
  ideas?: Approved;
};

export function NewObjectiveForm({
  held,
  onCreated,
  back,
  criteriaExtra,
  ideas,
}: FormOptions = {}) {
  const day = useBrowserDay();
  const own = useState<Draft>(DEFAULT_DRAFT);
  const [draft, setDraft] = held ?? own;
  const [errors, setErrors] = useState<Errors>({});
  const [shaking, setShaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Set on the first Create, before React renders the button disabled, so a
  // second click in the same moment sends nothing.
  const sending = useRef(false);
  const router = useRouter();
  const { show } = useToast();
  // An edit clears the errors of the checks it can change, and only those.
  const set = <K extends keyof Draft>(
    key: K,
    value: Draft[K] | ((current: Draft[K]) => Draft[K]),
  ) => {
    setDraft((d) => ({
      ...d,
      [key]:
        typeof value === "function"
          ? (value as (current: Draft[K]) => Draft[K])(d[key])
          : value,
    }));
    if (AFFECTS[key].some((f) => errors[f])) {
      setErrors((e) => {
        const next = { ...e };
        for (const f of AFFECTS[key]) delete next[f];
        return next;
      });
    }
  };
  const marked = (f: Field) => (errors[f] ? styles.hasError : "");

  // Start from (I-16): the choice, the idea picked, and what it filled in.
  const [origin, setOrigin] = useState<Origin>(null);
  const [filledFrom, setFilledFrom] = useState<ParkedIdea | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  // Only an idea still in the list can be sent: a refresh may drop one.
  const picked =
    ideas && ideas !== "unreachable"
      ? (ideas.find((i) => i.id === filledFrom?.id) ?? null)
      : null;
  const pick = (idea: ParkedIdea) => {
    const filled = fillFrom(draft, filledFrom, idea);
    set("name", filled.name);
    set("why", filled.why);
    setFilledFrom(idea);
    setStartError(null);
  };

  // The server has no browser to ask for the day; the form waits for it.
  if (!day) {
    return (
      <p className={styles.hint} aria-busy="true">
        Loading…
      </p>
    );
  }
  const { today, tz } = day;
  const starts = startChoices(today);
  const p = preview(draft, today);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending.current) return;
    const fromIdea = origin === "idea" && picked ? picked.id : null;
    const checked = checkDraft(draft, today, tz, fromIdea);
    const start = ideas ? checkStart(origin, fromIdea) : null;
    if (!checked.ok || start) {
      // Every error at once, one shake, and the first bad field focused.
      setErrors(checked.ok ? {} : checked.errors);
      setStartError(start);
      setShaking(true);
      const focus = start
        ? document.querySelector<HTMLElement>(
            '#nf-start-choices [role="radio"]',
          )
        : checked.ok
          ? null
          : document.getElementById(FOCUS[checked.first]);
      focus?.focus();
      return;
    }
    setErrors({});
    setStartError(null);

    sending.current = true;
    setBusy(true);
    setFailed(false);
    let status = 0;
    let res: Response | null = null;
    try {
      res = await fetch("/v1/objectives", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(checked.body),
      });
      status = res.status;
    } catch {
      // Not reached: the same as any other failure.
    }
    if (status === 201) {
      // The form is left, so `sending` stays set: nothing more is sent.
      const created = (await res?.json().catch(() => null)) as Objective | null;
      if (onCreated && created) {
        onCreated(created, today);
        return;
      }
      // It opens selected under Active, its row flashing once (I-11). Without
      // a body to name it, the list still shows it.
      show(createdMessage(checked.body.starts_on, today));
      router.push(
        created ? `/objectives/${created.id}?created=1` : "/objectives",
      );
      return;
    }
    if (status === 401) {
      router.push("/sign-in");
      return;
    }
    if (status === 422 && fromIdea) {
      // The idea was moved back or taken elsewhere: read the list again.
      sending.current = false;
      setBusy(false);
      setStartError(NO_LONGER_APPROVED);
      setFilledFrom(null);
      router.refresh();
      return;
    }
    // Everything entered stays; the page says nothing was created.
    sending.current = false;
    setBusy(false);
    setFailed(true);
  }

  return (
    <form
      className={`${styles.form} ${shaking ? styles.shake : ""}`}
      noValidate
      onSubmit={submit}
      onAnimationEnd={() => setShaking(false)}
    >
      {ideas ? (
        <StartFrom
          ideas={ideas}
          origin={origin}
          picked={picked?.id ?? null}
          error={startError}
          today={today}
          onOrigin={(o) => {
            setOrigin(o);
            setStartError(null);
          }}
          onPick={pick}
        />
      ) : null}
      <section className={styles.card} aria-labelledby="nf-what">
        <h2 className={styles.cardTitle} id="nf-what">
          What it is
        </h2>
        <div className={`${styles.field} ${marked("name")}`}>
          <CountedLabel
            htmlFor="nf-name"
            label="Name"
            length={draft.name.length}
            max={NAME_MAX}
          />
          <input
            id="nf-name"
            className={styles.input}
            maxLength={NAME_MAX}
            autoComplete="off"
            placeholder="e.g. Conversational English"
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            {...described("name", errors)}
          />
          <FieldError field="name" errors={errors} />
        </div>
        <div className={`${styles.field} ${marked("why")}`}>
          <CountedLabel
            htmlFor="nf-why"
            label="Why it matters"
            length={draft.why.length}
            max={TEXT_MAX}
          />
          <textarea
            id="nf-why"
            className={styles.textarea}
            maxLength={TEXT_MAX}
            placeholder="e.g. I want to speak up in English at work without rehearsing every sentence first."
            value={draft.why}
            onChange={(e) => set("why", e.target.value)}
            {...described("why", errors)}
          />
          <FieldError field="why" errors={errors} />
        </div>
        <div className={`${styles.field} ${marked("criteria")}`}>
          <CountedLabel
            htmlFor="nf-criteria"
            label="Success criteria · what would prove it worked"
            length={draft.criteria.length}
            max={TEXT_MAX}
          />
          <textarea
            id="nf-criteria"
            className={styles.textarea}
            maxLength={TEXT_MAX}
            {...described("criteria", errors, "nf-criteria-hint")}
            placeholder="e.g. Hold a 15-minute conversation in English without switching to my first language."
            value={draft.criteria}
            onChange={(e) => set("criteria", e.target.value)}
          />
          <span className={styles.hint} id="nf-criteria-hint">
            You&rsquo;ll check this at the final review, so make it something
            you can see happen.
          </span>
          {criteriaExtra}
          <FieldError field="criteria" errors={errors} />
        </div>
      </section>

      <section className={styles.card} aria-labelledby="nf-schedule">
        <h2 className={styles.cardTitle} id="nf-schedule">
          Schedule
        </h2>
        <div className={`${styles.field} ${marked("days")}`}>
          <span className={styles.label} id="nf-days-label">
            Which days
          </span>
          <div
            className={styles.days}
            role="group"
            aria-labelledby="nf-days-label"
            aria-describedby={errors.days ? errorId("days") : undefined}
          >
            {WEEKDAYS.map(([n, name]) => {
              const on = draft.weekdays.includes(n);
              return (
                <button
                  key={n}
                  id={`nf-day-${n}`}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  className={styles.chip}
                  onClick={() =>
                    set("weekdays", (days) =>
                      days.includes(n)
                        ? days.filter((d) => d !== n)
                        : [...days, n],
                    )
                  }
                >
                  {name}
                </button>
              );
            })}
          </div>
          <FieldError field="days" errors={errors} />
        </div>
        <div className={`${styles.field} ${marked("target")}`}>
          <span className={styles.label} id="nf-target-label">
            Daily target
          </span>
          <div
            className={styles.hm}
            role="group"
            aria-labelledby="nf-target-label"
          >
            <input
              id="nf-hours"
              className={`${styles.input} ${styles.num}`}
              inputMode="numeric"
              maxLength={2}
              aria-label="Hours"
              value={draft.hours}
              onChange={(e) => set("hours", onlyDigits(e.target.value))}
              {...described("target", errors)}
            />
            <span className={styles.unit}>h</span>
            <input
              id="nf-minutes"
              className={`${styles.input} ${styles.num}`}
              inputMode="numeric"
              maxLength={2}
              aria-label="Minutes"
              value={draft.minutes}
              onChange={(e) => set("minutes", onlyDigits(e.target.value))}
              {...described("target", errors)}
            />
            <span className={styles.unit}>m</span>
            <span className={styles.hint}>on each of those days</span>
          </div>
          <FieldError field="target" errors={errors} />
        </div>
      </section>

      <section className={styles.card} aria-labelledby="nf-plan">
        <h2 className={styles.cardTitle} id="nf-plan">
          Plan
        </h2>
        <div className={styles.field}>
          <span className={styles.label} id="nf-start-label">
            Starts
          </span>
          <RadioGroup<StartChoice>
            labelledBy="nf-start-label"
            className={styles.chips}
            optionClass={styles.chip}
            value={draft.start}
            onChange={(v) => set("start", v)}
            options={(
              [
                ["today", "Today"],
                ["tomorrow", "Tomorrow"],
                ["monday", "Next Monday"],
              ] as const
            ).map(([v, name]) => ({
              value: v,
              content: `${name} · ${dayLabel(starts[v], today)}`,
            }))}
          />
        </div>
        <div className={styles.two}>
          <div className={`${styles.field} ${marked("length")}`}>
            <span className={styles.label} id="nf-length-label">
              How long
            </span>
            <div
              className={styles.hm}
              role="group"
              aria-labelledby="nf-length-label"
            >
              <input
                id="nf-length"
                className={`${styles.input} ${styles.num}`}
                inputMode="numeric"
                maxLength={2}
                aria-label="How many"
                value={draft.length}
                onChange={(e) => set("length", onlyDigits(e.target.value))}
                {...described("length", errors)}
              />
              <Segments
                label="Unit"
                value={draft.unit}
                onChange={(v) => set("unit", v)}
                options={[
                  ["weeks", "Weeks"],
                  ["months", "Months"],
                ]}
              />
              <span className={styles.hint}>{p.endLabel}</span>
            </div>
            <FieldError field="length" errors={errors} />
          </div>
          <div className={styles.field}>
            <span className={styles.label} id="nf-cadence-label">
              Review every
            </span>
            <Segments
              labelledBy="nf-cadence-label"
              value={draft.cadence}
              onChange={(v) => set("cadence", v)}
              options={[
                ["weekly", "Week"],
                ["monthly", "Month"],
              ]}
            />
          </div>
        </div>
        <span className={styles.hint}>{p.reviewHint}</span>
        <dl className={styles.summary}>
          <div>
            <dt>Planned days</dt>
            <dd>{p.plannedDays}</dd>
          </div>
          <div>
            <dt>Each week</dt>
            <dd>{p.eachWeek}</dd>
          </div>
          <div>
            <dt>Reviews</dt>
            <dd>{p.reviews}</dd>
          </div>
        </dl>
      </section>

      <div className={styles.bar}>
        {failed ? (
          <div className={styles.banner} role="alert">
            <AlertIcon />
            <span>
              <b>Couldn&rsquo;t create the objective.</b> Nothing was created.
              Try again.
            </span>
          </div>
        ) : null}
        <span className={styles.hint}>
          Schedule and target are fixed once created. They change only when you
          extend at the final review.
        </span>
        <span className={styles.buttons}>
          {back ?? (
            <Link className={styles.muted} href="/objectives">
              Cancel
            </Link>
          )}
          <button
            className={styles.button}
            type="submit"
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {busy ? (
              <>
                <span className={styles.spin} aria-hidden="true" />
                Creating…
              </>
            ) : (
              "Create objective"
            )}
          </button>
        </span>
      </div>
    </form>
  );
}

/** "‹ Objectives": back to the list, nothing created. */
export function BackToObjectives() {
  return (
    <Link className={styles.back} href="/objectives">
      <BackIcon />
      Objectives
    </Link>
  );
}

/** The parts a caller's options are drawn with: the muted button, a hint. */
export const formParts = {
  muted: styles.muted,
  hint: styles.hint,
};
