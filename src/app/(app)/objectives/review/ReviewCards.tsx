"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ImprovementAnswer, Review } from "@/shared/contract";
import {
  hasChange,
  JUDGED_ELSEWHERE,
  JUDGED_ELSEWHERE_LOCKED,
  REFLECT,
  REFLECT_MAX,
  VERDICT_FAILED,
  verdictsOf,
  type ReflectField,
} from "@/modules/reviews/domain/reviewForm";
import {
  changeSetIn,
  chosenCard,
  IMPROVEMENT,
  IMPROVEMENT_ORDER,
  nothingToCheck,
  VERDICT,
  VERDICT_ORDER,
  type Verdict,
} from "@/modules/reviews/domain/reviewView";
import { CountedLabel, describedBy, errorIdOf, FieldError } from "../../form";
import { KindPill } from "../../deviations/KindPill";
import { Pill } from "../ObjectiveDetail";
import { latestWriter, type LatestWriter } from "./latestWriter";
import form from "../new/newObjective.module.css";
import styles from "./review.module.css";

/**
 * The parts a weekly or monthly review and a final review both ask
 * (05-reviews.md): the last change, the Chosen deviations with their
 * verdicts, the Reflect fields, and the radio chips they use. Moved out of
 * `ReviewForm` unchanged so the final review asks them the same way (I-14).
 */

export const ERR = (field: string) => errorIdOf("rv", field);

/** Where a field's error sends focus: the first radio, or the field itself. */
export const focusId = (field: string) =>
  field.startsWith("verdict:")
    ? `rv-${field.replace(":", "-")}`
    : field === "improvement_answer"
      ? "rv-improvement"
      : `rv-${field}`;

/** Scroll to the first error and focus it. */
export function focusFirst(field: string) {
  const el = document.getElementById(focusId(field));
  el?.scrollIntoView({ block: "center" });
  el?.focus({ preventScroll: true });
}

/**
 * A review's verdicts: each a PUT at once, one writer per deviation so the
 * newest wins, reverted with a reason under the deviation when it fails.
 */
export function useVerdicts(review: Pick<Review, "id" | "deviations">) {
  const router = useRouter();
  const [verdicts, setVerdicts] = useState(() => verdictsOf(review));
  const [verdictErrors, setVerdictErrors] = useState<Record<string, string>>(
    {},
  );
  const confirmed = useRef(verdictsOf(review));
  const writers = useRef(new Map<string, LatestWriter<Verdict>>());
  const writerFor = (id: string) => {
    let w = writers.current.get(id);
    if (!w) {
      w = latestWriter<Verdict>(async (verdict) => {
        const res = await fetch(
          `/v1/reviews/${review.id}/deviation-verdicts/${id}`,
          {
            method: "PUT",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ verdict }),
          },
        );
        if (res.ok) {
          confirmed.current = { ...confirmed.current, [id]: verdict };
          return true;
        }
        if (res.status === 401) router.push("/sign-in");
        // It goes back to what is stored, and says why under the deviation.
        setVerdicts((v) => ({ ...v, [id]: confirmed.current[id] ?? null }));
        setVerdictErrors((e) => ({
          ...e,
          [id]: res.status === 409 ? JUDGED_ELSEWHERE : VERDICT_FAILED,
        }));
        return false;
      });
      writers.current.set(id, w);
    }
    return w;
  };

  const judge = (id: string, verdict: Verdict) => {
    setVerdicts((v) => ({ ...v, [id]: verdict }));
    setVerdictErrors((e) =>
      Object.fromEntries(Object.entries(e).filter(([k]) => k !== id)),
    );
    writerFor(id).want(verdict);
  };

  /** Each writer's pending verdict, written now. */
  const flush = () => [...writers.current.values()].map((w) => w.flush());

  return {
    verdicts,
    verdictErrors,
    judge,
    flush,
    any: Object.values(verdicts).some((v) => v !== null),
  };
}

/** "Did last week's change work?": the quote and How did it go?, or nothing to check. */
export function ChangeAsk({
  review,
  previous,
  value,
  error,
  onChange,
}: {
  review: Review;
  previous: Review | null;
  value: ImprovementAnswer | null;
  error: string | undefined;
  onChange: (a: ImprovementAnswer) => void;
}) {
  return hasChange(review) ? (
    <>
      <p className={styles.quote}>
        &ldquo;{review.previous_what_changes_next}&rdquo;
        <small>{changeSetIn(previous, false)}</small>
      </p>
      <div className={`${form.field} ${error ? form.hasError : ""}`}>
        <span className={form.label} id="rv-improvement-label">
          How did it go?
        </span>
        <Choices<ImprovementAnswer>
          id="rv-improvement"
          labelledBy="rv-improvement-label"
          errorId={error ? ERR("improvement") : null}
          options={IMPROVEMENT_ORDER.map((a) => ({
            value: a,
            text: IMPROVEMENT[a],
          }))}
          value={value}
          onChange={onChange}
        />
        <FieldError id={ERR("improvement")} message={error} />
      </div>
    </>
  ) : (
    <div className={styles.done}>
      <span>{nothingToCheck(false)}</span>
      <Pill pill={{ text: "Nothing to check", tone: "neutral" }} />
    </div>
  );
}

/** The Chosen deviations of the period, each asking whether its reasoning held. */
export function ChosenAsk({
  review,
  today,
  verdicts,
  errors,
  verdictErrors,
  judge,
}: {
  review: Review;
  today: string;
  verdicts: Record<string, Verdict | null>;
  errors: Partial<Record<string, string>>;
  verdictErrors: Record<string, string>;
  judge: (id: string, v: Verdict) => void;
}) {
  const chosen = chosenCard(review, today);
  return chosen.blocks.length === 0 ? (
    <div className={styles.done}>
      <span>{chosen.none}</span>
      <span className={form.hint}>Nothing to judge</span>
    </div>
  ) : (
    <>
      {chosen.blocks.map((b) => {
        const message = errors[`verdict:${b.id}`] ?? verdictErrors[b.id];
        return (
          <div
            key={b.id}
            className={`${styles.chosen} ${message ? form.hasError : ""}`}
          >
            <div className={styles.meta}>
              <span>{b.when}</span>
              <KindPill kind="chosen" />
            </div>
            <b className={styles.what}>{b.what}</b>
            <div className={styles.reason}>
              <span>Your reasoning</span>
              {b.reasoning}
            </div>
            {b.locked ? (
              <div className={styles.locked}>
                <Pill
                  pill={{
                    text: VERDICT[b.locked],
                    tone: b.locked === "worth_it" ? "ok" : "behind",
                  }}
                />
                <span className={form.hint}>{JUDGED_ELSEWHERE_LOCKED}</span>
              </div>
            ) : (
              <>
                <span className={form.label} id={`rv-held-${b.id}`}>
                  Did the reasoning hold?
                </span>
                <Choices<Verdict>
                  id={`rv-verdict-${b.id}`}
                  labelledBy={`rv-held-${b.id}`}
                  errorId={message ? ERR(`verdict-${b.id}`) : null}
                  options={VERDICT_ORDER.map((v) => ({
                    value: v,
                    text: VERDICT[v],
                  }))}
                  value={verdicts[b.id] ?? null}
                  onChange={(v) => judge(b.id, v)}
                />
                <FieldError id={ERR(`verdict-${b.id}`)} message={message} />
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

/** The Reflect fields asked, each counted to its limit. */
export function ReflectAsk({
  fields,
  unit,
  answers,
  errors,
  onChange,
}: {
  fields: readonly ReflectField[];
  unit: "week" | "month";
  answers: Record<ReflectField, string>;
  errors: Partial<Record<string, string>>;
  onChange: (field: ReflectField, value: string) => void;
}) {
  return (
    <>
      {REFLECT.filter((r) => fields.includes(r.field)).map(
        ({ field, label, placeholder, hint }) => {
          const id = `rv-${field}`;
          const hintId = `${id}-hint`;
          const message = errors[field];
          return (
            <div
              key={field}
              className={`${form.field} ${message ? form.hasError : ""}`}
            >
              <CountedLabel
                htmlFor={id}
                label={label(unit)}
                length={answers[field].length}
                max={REFLECT_MAX}
              />
              <textarea
                id={id}
                className={form.textarea}
                maxLength={REFLECT_MAX}
                placeholder={placeholder}
                value={answers[field]}
                onChange={(e) => onChange(field, e.target.value)}
                {...describedBy(
                  message ? ERR(field) : null,
                  ...(hint ? [hintId] : []),
                )}
              />
              {hint ? (
                <span className={form.hint} id={hintId}>
                  {hint}
                </span>
              ) : null}
              <FieldError id={ERR(field)} message={message} />
            </div>
          );
        },
      )}
    </>
  );
}

/**
 * A row of radio chips (01-shell.md): the arrow keys move and pick, Space
 * picks. With nothing picked yet, the first chip takes Tab.
 */
export function Choices<T extends string>({
  id,
  labelledBy,
  errorId,
  options,
  value,
  onChange,
}: {
  id: string;
  labelledBy: string;
  errorId: string | null;
  options: { value: T; text: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (from: number, by: number) => {
    const to = (from + by + options.length) % options.length;
    onChange(options[to].value);
    refs.current[to]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className={form.chips}
      {...describedBy(errorId)}
    >
      {options.map((o, i) => (
        <button
          key={o.value}
          id={i === 0 ? id : undefined}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value || (value === null && i === 0) ? 0 : -1}
          className={form.chip}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              e.preventDefault();
              move(i, 1);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              e.preventDefault();
              move(i, -1);
            }
          }}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}
