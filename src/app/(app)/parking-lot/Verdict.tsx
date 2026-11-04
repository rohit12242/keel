"use client";

import { useId, useState } from "react";
import type { ParkedIdea } from "@/shared/contract";
import type { Verdict as VerdictName } from "@/modules/parking/domain/parkingView";
import { DropDialog } from "./DropDialog";
import styles from "./parkingLot.module.css";

const CHOICES: [VerdictName, string][] = [
  ["parked", "Still parked"],
  ["approved", "Approved"],
  ["dropped", "Dropped"],
];

/**
 * **Your verdict** (07-parking-lot.md): Still parked · Approved · Dropped on
 * a parked or approved idea. Buttons with `aria-pressed`, not radios, so
 * moving focus never gives a verdict. Dropped asks first, in its dialog.
 */
export function Verdict({
  idea,
  onVerdict,
}: {
  idea: ParkedIdea;
  onVerdict: (verdict: VerdictName, note: string | null) => void;
}) {
  const [dropping, setDropping] = useState(false);
  const label = useId();
  return (
    <div className={styles.verdict}>
      <span className={styles.lbl} id={label}>
        Your verdict
      </span>
      <div className={styles.segments} role="group" aria-labelledby={label}>
        {CHOICES.map(([v, name]) => (
          <button
            key={v}
            type="button"
            className={styles.segment}
            aria-pressed={idea.verdict === v}
            onClick={() => {
              if (idea.verdict === v) return;
              if (v === "dropped") setDropping(true);
              else onVerdict(v, null);
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <DropDialog
        open={dropping}
        idea={idea}
        onClose={() => setDropping(false)}
        onDrop={(why) => {
          setDropping(false);
          onVerdict("dropped", why);
        }}
      />
    </div>
  );
}
