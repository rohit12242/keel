"use client";

import Link from "next/link";
import { useState } from "react";
import { ForwardIcon } from "@/app/icons";
import type { Objective, ReviewList } from "@/shared/contract";
import {
  REVIEWS_FAILED,
  START_FAILED,
} from "@/modules/reviews/domain/reviewForm";
import {
  EXTENSION_NOT_MADE,
  MAKE_EXTENSION,
  pendingExtension,
} from "@/modules/reviews/domain/finalReview";
import {
  dueBanner,
  dueCards,
  emptyLine,
  savedList,
  type DueAction,
} from "@/modules/reviews/domain/reviewView";
import { Pill } from "./ObjectiveDetail";
import { useStartReview } from "./review/useStartReview";
import styles from "./objectives.module.css";

/**
 * The objective's Reviews tab (05-reviews.md, *Reviews tab*): Due, one card
 * per owed review, only the oldest opening; then Saved, newest first. Every
 * window, label and period is the API's (G19).
 */
export function ReviewsTab({
  o,
  reviews,
  tz,
  today,
}: {
  o: Objective;
  /** Null when they couldn't be read. */
  reviews: ReviewList | null;
  tz: string;
  today: string;
}) {
  const [showAll, setShowAll] = useState(false);
  if (!reviews) {
    return (
      <p className={styles.empty} role="alert">
        {REVIEWS_FAILED}
      </p>
    );
  }
  const cards = dueCards(reviews.due, reviews.reviews, tz, today);
  const saved = savedList(reviews.reviews, tz, today, showAll);
  return (
    <>
      {cards.length > 0 ? (
        <section className={styles.sec} aria-labelledby="od-due">
          <div className={styles.secHead}>
            <h3 id="od-due">Due</h3>
            <span className={styles.hint}>Reviews open oldest first</span>
          </div>
          {cards.map((c) => (
            <div
              key={c.key}
              className={`${styles.dueCard} ${
                c.action.kind === "wait" ? styles.dueWaiting : ""
              }`}
            >
              <div>
                <span className={styles.dueTitle}>
                  <b>{c.title}</b>
                  {c.draft ? (
                    <Pill pill={{ text: "Draft saved", tone: "neutral" }} />
                  ) : null}
                </span>
                <span className={styles.hint}>
                  {c.period}
                  {c.edited ? ` · ${c.edited}` : ""}
                </span>
              </div>
              <DueButton objectiveId={o.id} action={c.action} />
            </div>
          ))}
        </section>
      ) : saved.count === 0 ? (
        <p className={styles.empty}>{emptyLine(o.upcoming_review_on, today)}</p>
      ) : null}

      {saved.count > 0 ? (
        <section className={styles.sec} aria-labelledby="od-saved">
          <div className={styles.secHead}>
            <h3 id="od-saved">
              Saved <span className={styles.tabCount}>{saved.count}</span>
            </h3>
            <span className={styles.hint}>
              Newest first · kept exactly as written
            </span>
          </div>
          <div className={styles.sHead} aria-hidden="true">
            <span>Review</span>
            <span>Adherence</span>
            <span>Saved</span>
            <span />
          </div>
          {saved.groups.map((g, gi) => (
            <div key={g.heading ?? gi} className={styles.sGroup}>
              {g.heading ? (
                <h4 className={styles.sMonth}>{g.heading}</h4>
              ) : null}
              {g.rows.map((r) => (
                <Link
                  key={r.id}
                  className={styles.sRow}
                  href={`/objectives/${o.id}/reviews/${r.id}`}
                >
                  <span className={styles.sMain}>
                    <b>
                      {r.title}
                      {r.final ? (
                        <>
                          {" "}
                          <Pill pill={{ text: "Final", tone: "accent" }} />
                        </>
                      ) : null}
                    </b>
                    {r.sub ? (
                      <span className={styles.hint}>{r.sub}</span>
                    ) : null}
                  </span>
                  <span className={styles.sMini}>
                    <span className={styles.sBar} aria-hidden="true">
                      <i
                        className={styles[`sFill_${r.tone}`]}
                        style={{ width: `${r.pct ?? 0}%` }}
                      />
                    </span>
                    <span className={styles.sPct}>{r.pctText}</span>
                  </span>
                  <span className={styles.sDate}>{r.saved}</span>
                  <ForwardIcon />
                </Link>
              ))}
            </div>
          ))}
          {saved.hidden > 0 ? (
            <button
              type="button"
              className={styles.more}
              onClick={() => setShowAll(true)}
            >
              Show {saved.hidden} earlier review{saved.hidden === 1 ? "" : "s"}
            </button>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

/**
 * The due banner on Overview (04-objectives.md): the whole banner opens the
 * oldest due review, a final review like any other (I-14).
 */
export function DueBanner({
  o,
  reviews,
  today,
}: {
  o: Objective;
  reviews: ReviewList | null;
  today: string;
}) {
  const start = useStartReview(o.id);
  const b = reviews ? dueBanner(reviews.due, reviews.reviews, today) : null;
  if (!b) return null;
  const body = (
    <>
      <span className={styles.dueText}>
        <b>{b.title}</b>
        <span className={styles.hint}>{b.sub}</span>
      </span>
      <ActionLabel action={b.action} busy={start.busy} />
    </>
  );
  return (
    <div>
      {b.action.kind === "continue" ? (
        <Link
          className={styles.dueBanner}
          href={`/objectives/${o.id}/reviews/${b.action.reviewId}`}
        >
          {body}
        </Link>
      ) : b.action.kind === "start" ? (
        <button
          type="button"
          className={styles.dueBanner}
          onClick={start.start}
          disabled={start.busy}
          aria-busy={start.busy || undefined}
        >
          {body}
        </button>
      ) : (
        <div className={styles.dueBanner}>{body}</div>
      )}
      {start.failed ? (
        <p className={styles.dueFailed} role="alert">
          {START_FAILED}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A final review saved with Extend whose extension wasn't made (G49):
 * "The extension wasn't made." on the Overview. The banner opens the saved
 * final review with Make the extension's fields showing.
 */
export function ExtensionOwed({
  o,
  reviews,
}: {
  o: Objective;
  reviews: ReviewList | null;
}) {
  const owed = reviews ? pendingExtension(o, reviews.reviews) : null;
  if (!owed) return null;
  return (
    <Link
      className={styles.dueBanner}
      href={`/objectives/${o.id}/reviews/${owed.id}?extend=1`}
    >
      <span className={styles.dueText}>
        <b>{EXTENSION_NOT_MADE}</b>
        <span className={styles.hint}>
          The final review is saved with Extend.
        </span>
      </span>
      <span className={styles.dueGo}>{MAKE_EXTENSION}</span>
    </Link>
  );
}

function ActionLabel({ action, busy }: { action: DueAction; busy: boolean }) {
  switch (action.kind) {
    case "start":
      return (
        <span className={styles.dueGo}>
          {busy ? "Opening…" : "Start review"}
        </span>
      );
    case "continue":
      return <span className={styles.dueGo}>Continue draft</span>;
    default:
      return <span className={styles.hint}>{action.text}</span>;
  }
}

/** A due card's action: Start, Continue, or why it waits. */
function DueButton({
  objectiveId,
  action,
}: {
  objectiveId: string;
  action: DueAction;
}) {
  const start = useStartReview(objectiveId);
  switch (action.kind) {
    case "start":
      return (
        <span className={styles.dueAct}>
          <button
            type="button"
            className={styles.dueBtn}
            onClick={start.start}
            disabled={start.busy}
            aria-busy={start.busy || undefined}
          >
            {start.busy ? "Opening…" : "Start review"}
          </button>
          {start.failed ? (
            <span className={styles.dueFailed} role="alert">
              {START_FAILED}
            </span>
          ) : null}
        </span>
      );
    case "continue":
      return (
        <Link
          className={styles.dueBtn}
          href={`/objectives/${objectiveId}/reviews/${action.reviewId}`}
        >
          Continue draft
        </Link>
      );
    default:
      return <span className={styles.hint}>{action.text}</span>;
  }
}
