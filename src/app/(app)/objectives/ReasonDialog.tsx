"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useToast } from "@/app/toast";
import type { EffortEntry, Objective } from "@/shared/contract";
import { localDayOf } from "@/shared/time/localDay";
import {
  CHANGED_ELSEWHERE,
  checkReason,
  dialogWords,
  footer,
  loggedToday,
  notChanged,
  pausedToast,
  REASON_MAX,
  statusBody,
  TERMINATED,
  type ReasonKind,
} from "@/modules/objectives/domain/statusActions";
import { Dialog, dialogParts as parts } from "../Dialog";
import { CountedLabel, describedBy, errorIdOf, FieldError } from "../form";
import { useStatusChange } from "./useStatusChange";
import fields from "../logDeviation.module.css";
import styles from "./objectives.module.css";

/**
 * The Overview's footer (04-objectives.md): its line, and **Pause** and
 * **Terminate** where the status allows them, each opening its dialog with
 * the reason it requires (G12). The send and its busy flag live once, in
 * `useStatusChange`, so nothing outlives a save.
 */
export function StatusFooter({
  o,
  today,
  tz,
}: {
  o: Objective;
  today: string;
  tz: string;
}) {
  const f = footer(o, today);
  const [opened, setOpened] = useState<ReasonKind | null>(null);
  const change = useStatusChange(o.id);
  const close = () => setOpened(null);

  return (
    <div className={styles.foot}>
      <p className={styles.fine}>{f.line}</p>
      {f.pause || f.terminate ? (
        <div className={styles.footActions}>
          {f.pause ? (
            <button
              type="button"
              className={styles.pauseButton}
              onClick={() => setOpened("pause")}
            >
              Pause
            </button>
          ) : null}
          {f.terminate ? (
            <button
              type="button"
              className={styles.terminateButton}
              onClick={() => setOpened("terminate")}
            >
              Terminate
            </button>
          ) : null}
        </div>
      ) : null}
      <Dialog
        open={opened !== null}
        title={opened ? dialogWords(opened, o, today).title : ""}
        onClose={close}
        busy={change.busy}
      >
        {opened ? (
          <ReasonForm
            key={opened}
            kind={opened}
            o={o}
            today={today}
            tz={tz}
            change={change}
            onClose={close}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function ReasonForm({
  kind,
  o,
  today,
  tz,
  change,
  onClose,
}: {
  kind: ReasonKind;
  o: Objective;
  today: string;
  tz: string;
  change: ReturnType<typeof useStatusChange>;
  onClose: () => void;
}) {
  const words = dialogWords(kind, o, today);
  const { show } = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [minutes, setMinutes] = useState(0);
  const box = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const errorId = errorIdOf(id, "reason");
  const hintId = `${id}-hint`;

  // Pause on a day with time logged says the time stays, as extra. Read
  // only when it can matter; a failed read leaves the line out.
  const logged = kind === "pause" && o.last_logged_on === today;
  useEffect(() => {
    if (!logged) return;
    let live = true;
    fetch(`/v1/objectives/${o.id}/effort-entries?from=${today}&to=${today}`, {
      credentials: "same-origin",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { entries: EffortEntry[] } | null) => {
        if (live && body) {
          setMinutes(body.entries.reduce((sum, e) => sum + e.minutes, 0));
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [logged, o.id, today]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (change.busy) return;
    const missing = checkReason(kind, reason);
    if (missing) {
      setError(missing);
      setShaking(true);
      box.current?.focus();
      return;
    }
    setFailed(null);
    const day = localDayOf(new Date(), tz);
    const sent = await change.send(statusBody(kind, day, reason));
    if (sent === "done") {
      onClose();
      show(kind === "pause" ? pausedToast(o, day) : TERMINATED);
    } else if (sent === "conflict") setFailed(CHANGED_ELSEWHERE);
    else if (sent === "failed") setFailed(notChanged(kind));
  }

  const line = loggedToday(minutes);

  return (
    <form
      className={`${parts.form} ${shaking ? parts.shake : ""}`}
      noValidate
      onSubmit={submit}
      onAnimationEnd={() => setShaking(false)}
      aria-busy={change.busy || undefined}
    >
      <div className={parts.body}>
        {failed ? (
          <p className={fields.banner} role="alert">
            {failed}
          </p>
        ) : null}
        <p className={styles.p}>{words.body}</p>
        <div className={`${fields.field} ${error ? fields.hasError : ""}`}>
          <CountedLabel
            htmlFor={id}
            label={words.label}
            length={reason.length}
            max={REASON_MAX}
          />
          <textarea
            ref={box}
            id={id}
            className={fields.textarea}
            value={reason}
            maxLength={REASON_MAX}
            rows={3}
            data-autofocus
            {...describedBy(
              error ? errorId : null,
              ...(words.hint ? [hintId] : []),
            )}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
              setFailed(null);
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
          />
          <FieldError id={errorId} message={error ?? undefined} />
          {words.hint ? (
            <span className={styles.hint} id={hintId}>
              {words.hint}
            </span>
          ) : null}
        </div>
        {line ? <p className={styles.fine}>{line}</p> : null}
      </div>

      <div className={parts.foot}>
        <div className={parts.start}>
          <span className={parts.keys}>esc to close</span>
        </div>
        <div className={parts.actions}>
          <button
            type="button"
            className={parts.muted}
            disabled={change.busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={words.danger ? styles.dangerPrimary : parts.primary}
            disabled={change.busy}
            aria-busy={change.busy || undefined}
          >
            {words.action}
          </button>
        </div>
      </div>
    </form>
  );
}
