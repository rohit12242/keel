"use client";

import { useState } from "react";
import { useToast } from "@/app/toast";
import type { Objective, ReviewList } from "@/shared/contract";
import { localDayOf } from "@/shared/time/localDay";
import {
  CHANGED_ELSEWHERE,
  notChanged,
  resumedToast,
  statusBody,
} from "@/modules/objectives/domain/statusActions";
import { useStatusChange } from "./useStatusChange";
import styles from "./objectives.module.css";

/**
 * **Resume** on the Paused banner (04-objectives.md), with no dialog. The
 * day is today in the user's zone, when it is pressed.
 */
export function Resume({
  o,
  reviews,
  tz,
}: {
  o: Objective;
  reviews: ReviewList | null;
  tz: string;
}) {
  const { show } = useToast();
  const { busy, send } = useStatusChange(o.id);
  const [failed, setFailed] = useState<string | null>(null);

  async function resume() {
    const day = localDayOf(new Date(), tz);
    setFailed(null);
    const sent = await send(statusBody("resume", day));
    if (sent === "done") show(resumedToast(o, reviews?.reviews ?? [], day));
    else if (sent === "conflict") setFailed(CHANGED_ELSEWHERE);
    else if (sent === "failed") setFailed(notChanged("resume"));
  }

  return (
    <div className={styles.resume}>
      <button
        type="button"
        className={styles.resumeButton}
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={() => void resume()}
      >
        {busy ? "Resuming…" : "Resume"}
      </button>
      {failed ? (
        <p className={styles.failed} role="alert">
          {failed}
        </p>
      ) : null}
    </div>
  );
}
