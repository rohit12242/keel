"use client";

import {
  DISCARD_BODY,
  DISCARD_TITLE,
  NOT_DISCARDED,
} from "@/modules/reviews/domain/reviewForm";
import { Dialog, dialogParts } from "../../Dialog";
import { AlertIcon } from "../../form";
import formStyles from "../../form.module.css";
import styles from "./review.module.css";

/**
 * "Discard this draft?" (05-reviews.md, *Sticky bar*): Cancel, or a red
 * Discard. While the delete is in flight the dialog can't be closed; if it
 * fails, the dialog stays open and says nothing was deleted.
 */
export function DiscardDialog({
  open,
  busy,
  failed,
  onCancel,
  onDiscard,
}: {
  open: boolean;
  busy: boolean;
  failed: boolean;
  onCancel: () => void;
  onDiscard: () => void;
}) {
  return (
    <Dialog open={open} title={DISCARD_TITLE} onClose={onCancel} busy={busy}>
      <div className={dialogParts.body}>
        <p>{DISCARD_BODY}</p>
        {failed ? (
          <p className={formStyles.error} role="alert">
            <AlertIcon />
            <span>{NOT_DISCARDED}</span>
          </p>
        ) : null}
      </div>
      <div className={dialogParts.foot}>
        <span />
        <span className={dialogParts.actions}>
          <button
            type="button"
            className={dialogParts.muted}
            onClick={onCancel}
            disabled={busy}
            data-autofocus
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${dialogParts.primary} ${styles.discardConfirm}`}
            onClick={onDiscard}
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {busy ? "Discarding…" : "Discard"}
          </button>
        </span>
      </div>
    </Dialog>
  );
}
