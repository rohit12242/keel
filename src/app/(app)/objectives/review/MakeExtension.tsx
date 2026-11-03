"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useToast } from "@/app/toast";
import type { Objective } from "@/shared/contract";
import {
  EXTENSION_FAILED,
  EXTENSION_NOT_MADE,
  extendDraft,
  extendErrors,
  extensionMadeToast,
  MAKE_EXTENSION,
  type ExtendDraft,
  type FinalField,
} from "@/modules/reviews/domain/finalReview";
import { AlertIcon } from "../../form";
import { ExtendFields } from "./ExtendFields";
import { makeExtension } from "./FinalReviewForm";
import { focusFirst } from "./ReviewCards";
import form from "../new/newObjective.module.css";
import styles from "./review.module.css";

const ORDER = [
  "extend_length",
  "extend_days",
  "extend_target",
  "extend_reason",
] as const;

/**
 * A saved final review whose extension wasn't made (G49): "The extension
 * wasn't made." and Make the extension, which opens Extend's fields filled
 * in from the current plan and sends the same request again. Open at once
 * when the Overview's banner sent the user here (`?extend=1`).
 */
export function MakeExtension({
  objective: o,
  reviewId,
  today,
  open: initiallyOpen,
}: {
  objective: Objective;
  reviewId: string;
  today: string;
  open: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [open, setOpen] = useState(initiallyOpen);
  const [draft, setDraft] = useState<ExtendDraft>(() => extendDraft(o));
  const [errors, setErrors] = useState<Partial<Record<FinalField, string>>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const sending = useRef(false);

  async function make() {
    if (sending.current) return;
    const found = extendErrors(draft);
    const first = ORDER.find((f) => found[f]);
    if (first) {
      setErrors(found);
      focusFirst(first);
      return;
    }
    setErrors({});
    sending.current = true;
    setBusy(true);
    setFailed(false);
    const made = await makeExtension(o.id, reviewId, o, draft, today);
    if (made.segment) {
      show(extensionMadeToast(made.segment.end_date, today));
      router.push(`/objectives/${o.id}?tab=reviews`);
      return;
    }
    if (made.status === 401) {
      router.push("/sign-in");
      return;
    }
    sending.current = false;
    setBusy(false);
    setFailed(true);
  }

  return (
    <div className={styles.owed}>
      <div className={form.banner} role="status">
        <AlertIcon />
        <span>{EXTENSION_NOT_MADE}</span>
      </div>
      {open ? (
        <>
          <ExtendFields
            objective={o}
            draft={draft}
            onChange={setDraft}
            errors={errors}
            today={today}
          />
          {failed ? (
            <p className={styles.failed} role="alert">
              {EXTENSION_FAILED}
            </p>
          ) : null}
          <div>
            <button
              type="button"
              className={form.button}
              onClick={make}
              disabled={busy}
              aria-busy={busy || undefined}
            >
              {busy ? "Saving…" : MAKE_EXTENSION}
            </button>
          </div>
        </>
      ) : (
        <div>
          <button
            type="button"
            className={form.button}
            onClick={() => setOpen(true)}
          >
            {MAKE_EXTENSION}
          </button>
        </div>
      )}
    </div>
  );
}
