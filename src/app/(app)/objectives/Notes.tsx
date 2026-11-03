"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useToast } from "@/app/toast";
import type { Note } from "@/shared/contract";
import { localDayOf } from "@/shared/time/localDay";
import { dayLabel } from "@/modules/objectives/domain/newObjective";
import {
  NOTE_LINE,
  NOTE_MAX,
  NOTE_NOT_SAVED,
  NOTE_SAVED,
  noteBody,
} from "@/modules/objectives/domain/statusActions";
import { dialogParts as parts } from "../Dialog";
import styles from "./objectives.module.css";

/**
 * An objective's notes (01-shell.md, *Notes*): newest first, then
 * **+ Add a note** and its inline box. Append-only and open in every status
 * (G2). A saved note shows at once from the API's answer, then the page is
 * read again; the day is today in the user's zone, when it is saved.
 */
export function Notes({
  objectiveId,
  notes,
  today,
  tz,
}: {
  objectiveId: string;
  /** Oldest first, as the API returns them. */
  notes: readonly Note[];
  today: string;
  tz: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  // Saved here and not yet in the page's read.
  const [added, setAdded] = useState<Note[]>([]);
  const sending = useRef(false);
  const add = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const returnFocus = useRef(false);
  const id = useId();

  useEffect(() => {
    if (open) box.current?.focus();
    else if (returnFocus.current) {
      returnFocus.current = false;
      add.current?.focus();
    }
  }, [open]);

  const known = new Set(notes.map((n) => n.id));
  const shown = [...notes, ...added.filter((n) => !known.has(n.id))].reverse();

  function close() {
    returnFocus.current = true;
    setOpen(false);
    setText("");
    setFailed(null);
  }

  async function save() {
    if (sending.current) return;
    const body = noteBody(text, localDayOf(new Date(), tz));
    if (!body) return;
    sending.current = true;
    setBusy(true);
    setFailed(null);
    let res: Response | null = null;
    try {
      res = await fetch(`/v1/objectives/${objectiveId}/notes`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      res = null;
    }
    sending.current = false;
    setBusy(false);
    if (res?.status === 401) {
      router.push("/sign-in");
      return;
    }
    if (res?.status !== 201) {
      setFailed(NOTE_NOT_SAVED);
      return;
    }
    const note = (await res.json()) as Note;
    setAdded((a) => [...a, note]);
    close();
    show(NOTE_SAVED);
    startTransition(() => router.refresh());
  }

  return (
    <div className={styles.blk}>
      <span className={styles.lbl}>Notes</span>
      {shown.length > 0 ? (
        shown.map((n) => (
          <div key={n.id} className={styles.note}>
            <span className={styles.date}>{dayLabel(n.written_on, today)}</span>
            <p className={styles.p}>{n.text}</p>
          </div>
        ))
      ) : (
        <p className={styles.empty}>No notes yet.</p>
      )}
      {open ? (
        <form
          className={styles.noteBox}
          aria-busy={busy || undefined}
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {failed ? (
            <p className={styles.failed} role="alert">
              {failed}
            </p>
          ) : null}
          <textarea
            ref={box}
            className={styles.textarea}
            aria-label="Note"
            aria-describedby={id}
            value={text}
            maxLength={NOTE_MAX}
            rows={2}
            onChange={(e) => {
              setText(e.target.value);
              setFailed(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !busy) {
                e.preventDefault();
                close();
              } else if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void save();
              }
            }}
          />
          <div className={styles.noteFoot}>
            <span className={styles.fine} id={id}>
              {NOTE_LINE}{" "}
              <span
                className={`${styles.count} ${text.length >= NOTE_MAX ? styles.countFull : ""}`}
              >
                {text.length}/{NOTE_MAX}
              </span>
            </span>
            <div className={parts.actions}>
              <button
                type="button"
                className={parts.muted}
                disabled={busy}
                onClick={close}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={parts.primary}
                disabled={busy}
                aria-busy={busy || undefined}
              >
                {busy ? "Saving…" : "Save note"}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <button
          ref={add}
          type="button"
          className={styles.addNote}
          onClick={() => setOpen(true)}
        >
          + Add a note
        </button>
      )}
    </div>
  );
}
