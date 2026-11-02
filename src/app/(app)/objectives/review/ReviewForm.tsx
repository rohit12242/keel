"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useToast } from "@/app/toast";
import type { ImprovementAnswer, Review, ScheduleDay } from "@/shared/contract";
import {
  answersOf,
  BAR_NOTE,
  checkReview,
  DISCARDED,
  DRAFT_SAVED,
  hasChange,
  JUDGED_ELSEWHERE,
  JUDGED_ELSEWHERE_LOCKED,
  NOT_AUTOSAVED,
  NOT_SAVED,
  REFLECT,
  REFLECT_MAX,
  savedToast,
  VERDICT_FAILED,
  verdictsOf,
  type Answers,
  type Field,
} from "@/modules/reviews/domain/reviewForm";
import {
  cardTitles,
  changeSetIn,
  chosenCard,
  draftPill,
  IMPROVEMENT,
  IMPROVEMENT_ORDER,
  nothingToCheck,
  unitOf,
  VERDICT,
  VERDICT_ORDER,
  type Head,
  type Verdict,
} from "@/modules/reviews/domain/reviewView";
import {
  AlertIcon,
  CountedLabel,
  describedBy,
  errorIdOf,
  FieldError,
} from "../../form";
import { KindPill } from "../../deviations/KindPill";
import { Pill } from "../ObjectiveDetail";
import { DiscardDialog } from "./DiscardDialog";
import { latestWriter, type LatestWriter } from "./latestWriter";
import { Numbers } from "./Numbers";
import { ReviewHead } from "./ReviewHead";
import { CardHead } from "./SavedReview";
import { useAutosave } from "./useAutosave";
import form from "../new/newObjective.module.css";
import styles from "./review.module.css";

const ERR = (field: string) => errorIdOf("rv", field);

/** Where each field's error sends focus: the first radio, or the textarea. */
const focusId = (field: Field) =>
  field.startsWith("verdict:")
    ? `rv-${field.replace(":", "-")}`
    : field === "improvement_answer"
      ? "rv-improvement"
      : `rv-${field}`;

/**
 * The weekly or monthly review, as a draft (05-reviews.md): four cards, the
 * sticky bar, autosave, Save draft, Save review and Discard draft. Every
 * check and word is `modules/reviews/domain/reviewForm.ts`; the writes are
 * the API's own — PATCH the answers, PUT each verdict, POST the save, DELETE
 * the draft — each sent once, in order (plan step 5).
 */
export function ReviewForm({
  review,
  previous,
  grid,
  head,
  back,
  objectiveId,
  moreDue,
  tz,
  today,
}: {
  review: Review;
  previous: Review | null;
  grid: ScheduleDay[] | null;
  head: Head;
  back: { href: string; label: string };
  objectiveId: string;
  /** Other reviews due besides this one, for the saved toast. */
  moreDue: number;
  tz: string;
  today: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [answers, setAnswers] = useState<Answers>(() => answersOf(review));
  const [verdicts, setVerdicts] = useState(() => verdictsOf(review));
  const [lastSavedAt, setLastSavedAt] = useState(review.last_saved_at);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [verdictErrors, setVerdictErrors] = useState<Record<string, string>>(
    {},
  );
  const [shaking, setShaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [discard, setDiscard] = useState<"closed" | "open" | "busy" | "failed">(
    "closed",
  );
  const sending = useRef(false);
  const autosave = useAutosave(review, answers, setLastSavedAt);

  // Verdicts: one writer per deviation, and what the server last confirmed.
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

  const titles = cardTitles(review.kind, false);
  const unit = unitOf(review.kind);
  const chosen = useMemo(() => chosenCard(review, today), [review, today]);
  const anyVerdict = Object.values(verdicts).some((v) => v !== null);
  const canDiscard = lastSavedAt !== null || anyVerdict;

  const update = (next: Answers, now = false) => {
    setAnswers(next);
    autosave.change(next, now);
  };

  const judge = (id: string, verdict: Verdict) => {
    setVerdicts((v) => ({ ...v, [id]: verdict }));
    setVerdictErrors((e) =>
      Object.fromEntries(Object.entries(e).filter(([k]) => k !== id)),
    );
    writerFor(id).want(verdict);
  };

  const flushAll = async () => {
    const results = await Promise.all([
      autosave.flush(),
      ...[...writers.current.values()].map((w) => w.flush()),
    ]);
    return results.every(Boolean);
  };

  async function saveDraft() {
    if (await flushAll()) show(DRAFT_SAVED);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (sending.current) return;
    const checked = checkReview(answers, verdicts, review);
    if (!checked.ok) {
      // Every problem at once, one shake, and the first scrolled to.
      setErrors(checked.errors);
      setShaking(true);
      const el = document.getElementById(focusId(checked.first));
      el?.scrollIntoView({ block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }
    setErrors({});
    sending.current = true;
    setBusy(true);
    setFailed(false);
    let status = 0;
    if (await flushAll()) {
      try {
        const res = await fetch(`/v1/reviews/${review.id}/save`, {
          method: "POST",
          credentials: "same-origin",
        });
        status = res.status;
      } catch {
        // The same as any other failure.
      }
    }
    if (status === 200) {
      // The page is left, so `sending` stays set: nothing more is sent.
      autosave.stop();
      show(savedToast(head.title, moreDue));
      router.push(`/objectives/${objectiveId}?tab=reviews`);
      return;
    }
    if (status === 401) {
      router.push("/sign-in");
      return;
    }
    // Everything typed stays, and is still the draft.
    sending.current = false;
    setBusy(false);
    setFailed(true);
  }

  async function confirmDiscard() {
    if (sending.current) return;
    sending.current = true;
    setDiscard("busy");
    autosave.stop();
    // Let what is in flight land first, so nothing writes after the delete.
    await flushAll().catch(() => false);
    let status = 0;
    try {
      const res = await fetch(`/v1/reviews/${review.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      status = res.status;
    } catch {
      // The same as any other failure.
    }
    if (status === 204 || status === 404) {
      show(DISCARDED);
      router.push(`/objectives/${objectiveId}?tab=reviews`);
      return;
    }
    if (status === 401) {
      router.push("/sign-in");
      return;
    }
    sending.current = false;
    setDiscard("failed");
  }

  const pill = lastSavedAt ? (
    <Pill pill={{ text: draftPill(lastSavedAt, tz, today), tone: "neutral" }} />
  ) : undefined;

  return (
    <>
      <ReviewHead head={head} back={back} pill={pill} />
      <form
        className={`${form.form} ${shaking ? form.shake : ""}`}
        onAnimationEnd={() => setShaking(false)}
        onSubmit={save}
        noValidate
      >
        <Numbers
          review={review}
          previous={previous}
          grid={grid}
          today={today}
        />

        <section className={form.card} aria-labelledby="rv-change">
          <CardHead id="rv-change" n={2} title={titles.change} />
          {hasChange(review) ? (
            <>
              <p className={styles.quote}>
                &ldquo;{review.previous_what_changes_next}&rdquo;
                <small>{changeSetIn(previous, false)}</small>
              </p>
              <div
                className={`${form.field} ${errors.improvement_answer ? form.hasError : ""}`}
              >
                <span className={form.label} id="rv-improvement-label">
                  How did it go?
                </span>
                <Choices<ImprovementAnswer>
                  id="rv-improvement"
                  labelledBy="rv-improvement-label"
                  errorId={
                    errors.improvement_answer ? ERR("improvement") : null
                  }
                  options={IMPROVEMENT_ORDER.map((a) => ({
                    value: a,
                    text: IMPROVEMENT[a],
                  }))}
                  value={answers.improvement_answer}
                  onChange={(a) =>
                    update({ ...answers, improvement_answer: a }, true)
                  }
                />
                <FieldError
                  id={ERR("improvement")}
                  message={errors.improvement_answer}
                />
              </div>
            </>
          ) : (
            <div className={styles.done}>
              <span>{nothingToCheck(false)}</span>
              <Pill pill={{ text: "Nothing to check", tone: "neutral" }} />
            </div>
          )}
        </section>

        <section className={form.card} aria-labelledby="rv-chosen">
          <CardHead
            id="rv-chosen"
            n={3}
            title={titles.chosen}
            hint={chosen.hint}
          />
          {chosen.blocks.length === 0 ? (
            <div className={styles.done}>
              <span>{chosen.none}</span>
              <span className={form.hint}>Nothing to judge</span>
            </div>
          ) : (
            chosen.blocks.map((b) => {
              const key: Field = `verdict:${b.id}`;
              const message = errors[key] ?? verdictErrors[b.id];
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
                      <span className={form.hint}>
                        {JUDGED_ELSEWHERE_LOCKED}
                      </span>
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
                      <FieldError
                        id={ERR(`verdict-${b.id}`)}
                        message={message}
                      />
                    </>
                  )}
                </div>
              );
            })
          )}
        </section>

        <section className={form.card} aria-labelledby="rv-reflect">
          <CardHead id="rv-reflect" n={4} title={titles.reflect} />
          {REFLECT.map(({ field, label, placeholder, hint }) => {
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
                  onChange={(e) =>
                    update({ ...answers, [field]: e.target.value })
                  }
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
          })}
        </section>

        <div className={form.bar}>
          {failed ? (
            <div className={form.banner} role="alert">
              <AlertIcon />
              <span>{NOT_SAVED}</span>
            </div>
          ) : null}
          {autosave.failed && !failed ? (
            <p className={styles.note} role="status">
              {NOT_AUTOSAVED}
            </p>
          ) : null}
          {canDiscard ? (
            <button
              type="button"
              className={styles.discard}
              onClick={() => setDiscard("open")}
              disabled={busy}
            >
              Discard draft
            </button>
          ) : null}
          <span className={form.hint}>{BAR_NOTE}</span>
          <span className={form.buttons}>
            <button
              type="button"
              className={form.muted}
              onClick={saveDraft}
              disabled={busy}
            >
              Save draft
            </button>
            <button
              className={form.button}
              type="submit"
              disabled={busy}
              aria-busy={busy || undefined}
            >
              {busy ? (
                <>
                  <span className={form.spin} aria-hidden="true" />
                  Saving…
                </>
              ) : (
                "Save review"
              )}
            </button>
          </span>
        </div>
      </form>

      <DiscardDialog
        open={discard !== "closed"}
        busy={discard === "busy"}
        failed={discard === "failed"}
        onCancel={() => setDiscard("closed")}
        onDiscard={confirmDiscard}
      />
    </>
  );
}

/**
 * A row of radio chips (01-shell.md): the arrow keys move and pick, Space
 * picks. With nothing picked yet, the first chip takes Tab.
 */
function Choices<T extends string>({
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
