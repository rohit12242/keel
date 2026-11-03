"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useToast } from "@/app/toast";
import type { Review, ScheduleDay } from "@/shared/contract";
import {
  answersOf,
  BAR_NOTE,
  checkReview,
  DISCARDED,
  DRAFT_SAVED,
  NOT_AUTOSAVED,
  NOT_SAVED,
  patchBody,
  sameAnswers,
  savedToast,
  type Answers,
  type Field,
} from "@/modules/reviews/domain/reviewForm";
import {
  cardTitles,
  chosenCard,
  draftPill,
  unitOf,
  type Head,
} from "@/modules/reviews/domain/reviewView";
import { AlertIcon } from "../../form";
import { Pill } from "../ObjectiveDetail";
import { DiscardDialog } from "./DiscardDialog";
import { Numbers } from "./Numbers";
import {
  ChangeAsk,
  ChosenAsk,
  focusFirst,
  ReflectAsk,
  useVerdicts,
} from "./ReviewCards";
import { ReviewHead } from "./ReviewHead";
import { CardHead } from "./SavedReview";
import { useAutosave, type Codec } from "./useAutosave";
import form from "../new/newObjective.module.css";
import styles from "./review.module.css";

/** What a weekly or monthly draft sends; a constant, as useAutosave needs. */
const CODEC: Codec<Answers> = { body: patchBody, same: sameAnswers };

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
  const [lastSavedAt, setLastSavedAt] = useState(review.last_saved_at);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [shaking, setShaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [discard, setDiscard] = useState<"closed" | "open" | "busy" | "failed">(
    "closed",
  );
  const sending = useRef(false);
  const autosave = useAutosave(review, answers, setLastSavedAt, CODEC);
  const v = useVerdicts(review);

  const titles = cardTitles(review.kind, false);
  const unit = unitOf(review.kind);
  const chosen = useMemo(() => chosenCard(review, today), [review, today]);
  const canDiscard = lastSavedAt !== null || v.any;

  const update = (next: Answers, now = false) => {
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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (sending.current) return;
    const checked = checkReview(answers, v.verdicts, review);
    if (!checked.ok) {
      // Every problem at once, one shake, and the first scrolled to.
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
          <ChangeAsk
            review={review}
            previous={previous}
            value={answers.improvement_answer}
            error={errors.improvement_answer}
            onChange={(x) =>
              update({ ...answers, improvement_answer: x }, true)
            }
          />
        </section>

        <section className={form.card} aria-labelledby="rv-chosen">
          <CardHead
            id="rv-chosen"
            n={3}
            title={titles.chosen}
            hint={chosen.hint}
          />
          <ChosenAsk
            review={review}
            today={today}
            verdicts={v.verdicts}
            errors={errors}
            verdictErrors={v.verdictErrors}
            judge={v.judge}
          />
        </section>

        <section className={form.card} aria-labelledby="rv-reflect">
          <CardHead id="rv-reflect" n={4} title={titles.reflect} />
          <ReflectAsk
            fields={["what_worked", "what_got_in_the_way", "what_changes_next"]}
            unit={unit}
            answers={answers}
            errors={errors}
            onChange={(field, value) => update({ ...answers, [field]: value })}
          />
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
