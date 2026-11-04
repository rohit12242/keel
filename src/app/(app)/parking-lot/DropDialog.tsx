"use client";

import { useState } from "react";
import type { ParkedIdea } from "@/shared/contract";
import { checkDrop, DROP_WHY_MAX } from "@/modules/parking/domain/parkingView";
import { Dialog, dialogParts as parts } from "../Dialog";
import { CountedLabel, describedBy, FieldError } from "../form";
import styles from "./parkingLot.module.css";

/**
 * Drop this idea? (07-parking-lot.md): the idea and why it grabbed you,
 * then why it ended, required. **Drop it** sends nothing: the drop is held
 * like any verdict, with **Undo** in its toast (G13), so the dialog has no
 * busy state.
 */
export function DropDialog({
  open,
  idea,
  onClose,
  onDrop,
}: {
  open: boolean;
  idea: ParkedIdea;
  onClose: () => void;
  onDrop: (why: string) => void;
}) {
  return (
    <Dialog open={open} title="Drop this idea?" onClose={onClose}>
      {open ? <DropForm idea={idea} onClose={onClose} onDrop={onDrop} /> : null}
    </Dialog>
  );
}

function DropForm({
  idea,
  onClose,
  onDrop,
}: {
  idea: ParkedIdea;
  onClose: () => void;
  onDrop: (why: string) => void;
}) {
  const [why, setWhy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = checkDrop(why);
    if (problem) {
      setError(problem);
      setShaking(true);
      document.getElementById("pd-why")?.focus();
      return;
    }
    onDrop(why);
  }

  return (
    <form
      className={`${parts.form} ${shaking ? parts.shake : ""}`}
      noValidate
      onSubmit={submit}
      onAnimationEnd={() => setShaking(false)}
    >
      <div className={parts.body}>
        <blockquote className={styles.quote}>
          <b>{idea.idea}</b>
          <span className={styles.lbl}>Why it grabbed you</span>
          <span>{idea.why}</span>
        </blockquote>
        <div className={`${styles.field} ${error ? styles.hasError : ""}`}>
          <CountedLabel
            htmlFor="pd-why"
            label="Why"
            length={why.length}
            max={DROP_WHY_MAX}
          />
          <textarea
            id="pd-why"
            className={styles.textarea}
            maxLength={DROP_WHY_MAX}
            rows={3}
            placeholder="What changed since you parked it?"
            data-autofocus
            value={why}
            onChange={(e) => {
              setWhy(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            {...describedBy(error ? "pd-why-error" : null)}
          />
          <FieldError id="pd-why-error" message={error ?? undefined} />
        </div>
      </div>
      <div className={parts.foot}>
        <div className={parts.start}>
          <span className={parts.keys}>esc to close</span>
        </div>
        <div className={parts.actions}>
          <button type="button" className={parts.muted} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.dropButton}>
            Drop it
          </button>
        </div>
      </div>
    </form>
  );
}
