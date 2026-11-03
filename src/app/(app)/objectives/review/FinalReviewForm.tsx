"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useToast } from "@/app/toast";
import type { Objective, PlanSegment, Review } from "@/shared/contract";
import {
  BAR_NOTE,
  DISCARDED,
  DRAFT_SAVED,
  NOT_AUTOSAVED,
  NOT_SAVED,
} from "@/modules/reviews/domain/reviewForm";
import { draftPill, type Head } from "@/modules/reviews/domain/reviewView";
import {
  checkFinal,
  completedToast,
  CRITERIA,
  CRITERIA_MAX,
  CRITERIA_ORDER,
  criteriaSet,
  EXTEND_BAR,
  extendDraft,
  extendedToast,
  extendErrors,
  EXTENSION_FAILED,
  EXTENSION_NOT_MADE,
  extensionBody,
  finalAnswersOf,
  finalPatch,
  MAKE_EXTENSION,
  OUTCOMES,
  sameFinal,
  saveLabel,
  type CriteriaVerdict,
  type ExtendDraft,
  type FinalAnswers,
  type FinalField,
  type Outcome,
} from "@/modules/reviews/domain/finalReview";
import { AlertIcon, CountedLabel, describedBy, FieldError } from "../../form";
import { Pill } from "../ObjectiveDetail";
import { DiscardDialog } from "./DiscardDialog";
import { ExtendFields } from "./ExtendFields";
import { PlanNumbers } from "./PlanNumbers";
import {
  ChangeAsk,
  Choices,
  ChosenAsk,
  ERR,
  focusFirst,
  ReflectAsk,
  useVerdicts,
} from "./ReviewCards";
import { ReviewHead } from "./ReviewHead";
import { CardHead } from "./SavedReview";
import { useAutosave, type Codec } from "./useAutosave";
import form from "../new/newObjective.module.css";
import styles from "./review.module.css";

/** What a final review's draft sends; a constant, as useAutosave needs. */
const CODEC: Codec<FinalAnswers> = { body: finalPatch, same: sameFinal };

/**
 * Make the extension a saved final review authorises (G9, G49): the second
 * of the two calls. Returns the new segment, or null when it wasn't made.
 */
export async function makeExtension(
  objectiveId: string,
  reviewId: string,
  o: Pick<Objective, "end_date">,
  d: ExtendDraft,
  today: string,
): Promise<{ segment: PlanSegment | null; status: number }> {
  try {
    const res = await fetch(`/v1/objectives/${objectiveId}/extensions`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(extensionBody(reviewId, o, d, today)),
    });
    return {
      segment: res.status === 201 ? ((await res.json()) as PlanSegment) : null,
      status: res.status,
    };
  } catch {
    return { segment: null, status: 0 };
  }
}

/**
 * The final review, as a draft (05-reviews.md, *Final review*): five cards,
 * the sticky bar, autosave, Save draft and Discard draft as a weekly review
 * has them, and a save that names its outcome. Complete saves the review,
 * which completes the objective. Extend saves the review, then makes the
 * extension — two calls (G9). If the second fails the review stays saved,
 * the page stays, and Make the extension tries again with what was entered
 * (G49).
 */
export function FinalReviewForm({
  review,
  previous,
  objective: o,
  head,
  back,
  tz,
  today,
}: {
  review: Review;
  previous: Review | null;
  objective: Objective;
  head: Head;
  back: { href: string; label: string };
  tz: string;
  today: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [answers, setAnswers] = useState<FinalAnswers>(() =>
    finalAnswersOf(review),
  );
  const [ext, setExt] = useState<ExtendDraft>(() => extendDraft(o));
  const [lastSavedAt, setLastSavedAt] = useState(review.last_saved_at);
  const [errors, setErrors] = useState<Partial<Record<FinalField, string>>>({});
  const [shaking, setShaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Saved with Extend, and the extension not yet made (G49).
  const [owed, setOwed] = useState<"no" | "owed" | "retry_failed">("no");
  const [discard, setDiscard] = useState<"closed" | "open" | "busy" | "failed">(
    "closed",
  );
  const sending = useRef(false);
  const autosave = useAutosave(review, answers, setLastSavedAt, CODEC);
  const v = useVerdicts(review);
  const locked = owed !== "no";
  const canDiscard = !locked && (lastSavedAt !== null || v.any);
  const reviewsTab = `/objectives/${o.id}?tab=reviews`;

  const update = (next: FinalAnswers, now = false) => {
    setAnswers(next);
    autosave.change(next, now);
  };

  const flushAll = async () => {
    const results = await Promise.all([autosave.flush(), ...v.flush()]);
    return results.every(Boolean);
  };

  async function saveDraft() {
    if (await flushAll()) show(DRAFT_SAVED);
  }

  /** The second call: the review is saved; on 201 the page is left. */
  async function extend(): Promise<boolean> {
    const made = await makeExtension(o.id, review.id, o, ext, today);
    if (made.segment) {
      show(extendedToast(made.segment.end_date, today));
      router.push(reviewsTab);
      return true;
    }
    if (made.status === 401) router.push("/sign-in");
    return false;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (sending.current || locked) return;
    const checked = checkFinal(answers, v.verdicts, review, ext);
    if (!checked.ok) {
      setErrors(checked.errors);
      setShaking(true);
      focusFirst(checked.first);
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
    if (status === 401) {
      router.push("/sign-in");
      return;
    }
    if (status !== 200) {
      // Everything typed stays, and is still the draft.
      sending.current = false;
      setBusy(false);
      setFailed(true);
      return;
    }
    // Saved: nothing more autosaves, whatever happens next.
    autosave.stop();
    if (answers.outcome === "completed") {
      show(completedToast(o.title));
      router.push(reviewsTab);
      return;
    }
    if (await extend()) return;
    // The review is saved and the extension isn't made (G49).
    sending.current = false;
    setBusy(false);
    setOwed("owed");
  }

  async function retry() {
    if (sending.current) return;
    const found = extendErrors(ext);
    const first = (
      [
        "extend_length",
        "extend_days",
        "extend_target",
        "extend_reason",
      ] as const
    ).find((f) => found[f]);
    if (first) {
      setErrors(found);
      focusFirst(first);
      return;
    }
    setErrors({});
    sending.current = true;
    setBusy(true);
    if (await extend()) return;
    sending.current = false;
    setBusy(false);
    setOwed("retry_failed");
  }

  async function confirmDiscard() {
    if (sending.current) return;
    sending.current = true;
    setDiscard("busy");
    autosave.stop();
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
      router.push(reviewsTab);
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
  const extending = answers.outcome === "continued";

  return (
    <>
      <ReviewHead head={head} back={back} pill={pill} />
      <form
        className={`${form.form} ${shaking ? form.shake : ""}`}
        onAnimationEnd={() => setShaking(false)}
        onSubmit={save}
        noValidate
      >
        {locked ? (
          <div className={form.banner} role="alert">
            <AlertIcon />
            <span>
              The review is saved. {EXTENSION_NOT_MADE}{" "}
              {owed === "retry_failed" ? EXTENSION_FAILED : ""}
            </span>
          </div>
        ) : null}

        <fieldset className={styles.plain} disabled={locked}>
          <PlanNumbers
            review={review}
            weeks={o.weeks}
            startDate={o.start_date}
          />

          <section className={form.card} aria-labelledby="rv-change">
            <CardHead
              id="rv-change"
              n={2}
              title="Last change and Chosen deviations"
              hint="Same as a weekly review"
            />
            <ChangeAsk
              review={review}
              previous={previous}
              value={answers.improvement_answer}
              error={errors.improvement_answer}
              onChange={(x) =>
                update({ ...answers, improvement_answer: x }, true)
              }
            />
            <h3 className={styles.sub3}>Chosen deviations in the last week</h3>
            <ChosenAsk
              review={review}
              today={today}
              verdicts={v.verdicts}
              errors={errors}
              verdictErrors={v.verdictErrors}
              judge={v.judge}
            />
          </section>

          <section className={form.card} aria-labelledby="rv-criteria">
            <CardHead id="rv-criteria" n={3} title="Success criteria" />
            <p className={styles.quote}>
              &ldquo;{o.success_criteria}&rdquo;
              <small>{criteriaSet(o, today)}</small>
            </p>
            <div
              className={`${form.field} ${errors.criteria_verdict ? form.hasError : ""}`}
            >
              <span className={form.label} id="rv-criteria-label">
                Where you are
              </span>
              <Choices<CriteriaVerdict>
                id="rv-criteria_verdict"
                labelledBy="rv-criteria-label"
                errorId={
                  errors.criteria_verdict ? ERR("criteria_verdict") : null
                }
                options={CRITERIA_ORDER.map((c) => ({
                  value: c,
                  text: CRITERIA[c],
                }))}
                value={answers.criteria_verdict}
                onChange={(c) =>
                  update({ ...answers, criteria_verdict: c }, true)
                }
              />
              <FieldError
                id={ERR("criteria_verdict")}
                message={errors.criteria_verdict}
              />
            </div>
            <div
              className={`${form.field} ${errors.criteria_assessment ? form.hasError : ""}`}
            >
              <CountedLabel
                htmlFor="rv-criteria_assessment"
                label="What shows it"
                length={answers.criteria_assessment.length}
                max={CRITERIA_MAX}
              />
              <textarea
                id="rv-criteria_assessment"
                className={form.textarea}
                maxLength={CRITERIA_MAX}
                value={answers.criteria_assessment}
                onChange={(e) =>
                  update({ ...answers, criteria_assessment: e.target.value })
                }
                {...describedBy(
                  errors.criteria_assessment
                    ? ERR("criteria_assessment")
                    : null,
                )}
              />
              <FieldError
                id={ERR("criteria_assessment")}
                message={errors.criteria_assessment}
              />
            </div>
          </section>

          <section className={form.card} aria-labelledby="rv-reflect">
            <CardHead id="rv-reflect" n={4} title="Reflect" />
            <ReflectAsk
              fields={["what_worked", "what_got_in_the_way"]}
              unit="week"
              answers={answers}
              errors={errors}
              onChange={(field, value) =>
                update({ ...answers, [field]: value })
              }
            />
          </section>
        </fieldset>

        <section className={form.card} aria-labelledby="rv-next">
          <CardHead id="rv-next" n={5} title="What next" />
          <fieldset className={styles.plain} disabled={locked}>
            <div
              className={`${form.field} ${errors.outcome ? form.hasError : ""}`}
            >
              <span className={form.label} id="rv-outcome-label">
                Complete or extend
              </span>
              <OutcomeCards
                value={answers.outcome}
                error={errors.outcome ? ERR("outcome") : null}
                onChange={(x) => update({ ...answers, outcome: x }, true)}
              />
              <FieldError id={ERR("outcome")} message={errors.outcome} />
            </div>
          </fieldset>
          {extending ? (
            <ExtendFields
              objective={o}
              draft={ext}
              onChange={setExt}
              errors={errors}
              today={today}
            />
          ) : null}
        </section>

        <div className={form.bar}>
          {failed ? (
            <div className={form.banner} role="alert">
              <AlertIcon />
              <span>{NOT_SAVED}</span>
            </div>
          ) : null}
          {autosave.failed && !failed && !locked ? (
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
          <span className={form.hint}>
            {extending ? `${BAR_NOTE} ${EXTEND_BAR}` : BAR_NOTE}
          </span>
          <span className={form.buttons}>
            {locked ? (
              <button
                type="button"
                className={form.button}
                onClick={retry}
                disabled={busy}
                aria-busy={busy || undefined}
              >
                {busy ? <Busy /> : MAKE_EXTENSION}
              </button>
            ) : (
              <>
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
                  {busy ? <Busy /> : saveLabel(answers.outcome)}
                </button>
              </>
            )}
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

const Busy = () => (
  <>
    <span className={form.spin} aria-hidden="true" />
    Saving…
  </>
);

/** Complete it · Extend it: two choice cards, a radio group with the arrow keys. */
function OutcomeCards({
  value,
  error,
  onChange,
}: {
  value: Outcome | null;
  error: string | null;
  onChange: (o: Outcome) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (from: number, by: number) => {
    const to = (from + by + OUTCOMES.length) % OUTCOMES.length;
    onChange(OUTCOMES[to].id);
    refs.current[to]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-labelledby="rv-outcome-label"
      className={styles.outcomes}
      {...describedBy(error)}
    >
      {OUTCOMES.map((x, i) => (
        <button
          key={x.id}
          id={i === 0 ? "rv-outcome" : undefined}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={x.id === value}
          tabIndex={x.id === value || (value === null && i === 0) ? 0 : -1}
          className={styles.outcome}
          onClick={() => onChange(x.id)}
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
          <b>{x.title}</b>
          <span>{x.body}</span>
        </button>
      ))}
    </div>
  );
}
