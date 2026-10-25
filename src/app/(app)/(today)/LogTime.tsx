"use client";

import { useRef, useState } from "react";
import type { Day, EffortEntry } from "@/shared/contract";
import {
  buttonLabel,
  checkEntry,
  clockIn,
  durationLabel,
  fitTime,
  hint,
  NOTE_MAX,
  nowTimes,
  parseTime,
  spanMinutes,
  type Draft,
  type EntryBody,
  type EntryField,
} from "@/modules/today/domain/logTime";
import { loggable } from "@/modules/today/domain/todayView";
import { Dialog, dialogParts as parts } from "../Dialog";
import { CountedLabel, describedBy, errorIdOf, FieldError } from "../form";
import styles from "./logTime.module.css";

/**
 * Log time, and Edit entry (03-today.md). The rules — the times it reads,
 * its checks, the hint, the button — are in `modules/today/domain/logTime.ts`;
 * this draws them and hands a checked body to `onSave`, which sends it.
 * `onSave` answers with a field error to show, a message for the banner,
 * or nothing once it has closed the dialog.
 */

export type SaveOutcome =
  { done: true } | { done: false; field?: EntryField; message: string };

export type Opened =
  | { kind: "new"; objectiveId: string | null }
  | { kind: "edit"; entry: EffortEntry };

type Errors = Partial<Record<EntryField, string>>;

const errorId = (f: EntryField) => errorIdOf("lt", f);

/** Where focus goes when a field holds the first error. */
const FOCUS: Record<EntryField, string> = {
  objective: "lt-objective-0",
  when: "lt-start",
  note: "lt-note",
};

/** The end of an entry, from its start and minutes, as the dialog shows it. */
const endOf = (start: string, minutes: number) => {
  const m = Number(start.slice(0, 2)) * 60 + Number(start.slice(3)) + minutes;
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

function initialDraft(opened: Opened): Draft {
  if (opened.kind === "new") {
    return { objectiveId: opened.objectiveId, start: "", end: "", note: "" };
  }
  const e = opened.entry;
  return {
    objectiveId: e.objective_id,
    start: e.occurred_at_local ?? "",
    end: e.occurred_at_local ? endOf(e.occurred_at_local, e.minutes) : "",
    note: e.note,
  };
}

export function LogTime({
  opened,
  day,
  zone,
  onClose,
  onSave,
  onDelete,
}: {
  opened: Opened | null;
  day: Day;
  zone: string;
  onClose: () => void;
  onSave: (objectiveId: string, body: EntryBody) => Promise<SaveOutcome>;
  onDelete?: (entry: EffortEntry) => Promise<SaveOutcome>;
}) {
  // Held here as well as in the form, so Esc can't close mid-request.
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={opened !== null}
      title={opened?.kind === "edit" ? "Edit entry" : "Log time"}
      onClose={onClose}
      busy={busy}
    >
      {opened ? (
        <LogTimeForm
          // A new form each time the dialog opens, so nothing carries over.
          key={opened.kind === "edit" ? opened.entry.id : "new"}
          opened={opened}
          day={day}
          zone={zone}
          onClose={onClose}
          onSave={onSave}
          onDelete={onDelete}
          onBusy={setBusy}
        />
      ) : null}
    </Dialog>
  );
}

function LogTimeForm({
  opened,
  day,
  zone,
  onClose,
  onSave,
  onDelete,
  onBusy,
}: {
  opened: Opened;
  day: Day;
  zone: string;
  onClose: () => void;
  onSave: (objectiveId: string, body: EntryBody) => Promise<SaveOutcome>;
  onDelete?: (entry: EffortEntry) => Promise<SaveOutcome>;
  onBusy: (busy: boolean) => void;
}) {
  const editing = opened.kind === "edit" ? opened.entry : undefined;
  // Opened from a card or an entry, the objective is known: focus starts at
  // the times. From the header, at the objective.
  const preset = editing
    ? editing.objective_id
    : opened.kind === "new"
      ? opened.objectiveId
      : null;
  const [draft, setDraft] = useState<Draft>(() => initialDraft(opened));
  const [errors, setErrors] = useState<Errors>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusyHere] = useState(false);
  const [shaking, setShaking] = useState(false);
  const setBusy = (b: boolean) => {
    setBusyHere(b);
    onBusy(b);
  };
  // Set before the request, so a second click or Enter sends nothing.
  const sending = useRef(false);

  const choices = editing
    ? day.objectives.filter((o) => o.id === editing.objective_id)
    : day.objectives.filter((o) => loggable(o, day.date));
  const chosen = day.objectives.find((o) => o.id === draft.objectiveId);
  const minutes = spanMinutes(draft.start, draft.end);
  const noteMax = Math.max(NOTE_MAX, editing?.note.length ?? 0);
  const entries = day.objectives.flatMap((o) =>
    o.entries.map((e) => ({
      id: e.id,
      occurred_at_local: e.occurred_at_local,
      minutes: e.minutes,
      note: e.note,
    })),
  );

  // An edit clears that field's error, and only that one.
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    const field: EntryField =
      key === "objectiveId" ? "objective" : key === "note" ? "note" : "when";
    if (errors[field]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[field];
        return next;
      });
    }
  };

  // A time box shows what it read, "920" as "09:20", once focus leaves it.
  const tidy = (key: "start" | "end") => {
    const t = parseTime(draft[key]);
    if (t && t !== draft[key]) setDraft((d) => ({ ...d, [key]: t }));
  };

  async function run(send: () => Promise<SaveOutcome>) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setFailed(null);
    const outcome = await send();
    // Done, the dialog has closed; clear its hold, or the next one opens with
    // × and Esc still refused. This form stays busy until it unmounts.
    if (outcome.done) {
      onBusy(false);
      return;
    }
    sending.current = false;
    setBusy(false);
    if (outcome.field) {
      setErrors({ [outcome.field]: outcome.message });
      document.getElementById(FOCUS[outcome.field])?.focus();
    } else {
      setFailed(outcome.message);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending.current) return;
    const checked = checkEntry(draft, {
      date: day.date,
      zone,
      now: clockIn(new Date(), zone),
      entries,
      editing: editing && {
        id: editing.id,
        occurred_at_local: editing.occurred_at_local,
        minutes: editing.minutes,
        note: editing.note,
      },
    });
    if (!checked.ok) {
      setErrors(checked.errors);
      setShaking(true);
      document.getElementById(FOCUS[checked.first])?.focus();
      return;
    }
    setErrors({});
    await run(() => onSave(checked.objectiveId, checked.body));
  }

  return (
    <form
      className={`${parts.form} ${shaking ? parts.shake : ""}`}
      noValidate
      onSubmit={submit}
      onAnimationEnd={() => setShaking(false)}
      aria-busy={busy || undefined}
    >
      <div className={parts.body}>
        {failed ? (
          <p className={styles.banner} role="alert">
            {failed}
          </p>
        ) : null}

        <fieldset
          className={`${styles.field} ${errors.objective ? styles.hasError : ""}`}
          aria-describedby={errors.objective ? errorId("objective") : undefined}
        >
          <legend className={styles.label}>Objective</legend>
          <div className={styles.chips}>
            {choices.map((o, i) => (
              <label key={o.id} className={styles.chip}>
                <input
                  id={`lt-objective-${i}`}
                  className={styles.radio}
                  type="radio"
                  name="lt-objective"
                  value={o.id}
                  checked={draft.objectiveId === o.id}
                  disabled={!!editing}
                  data-autofocus={(!preset && i === 0) || undefined}
                  onChange={() => set("objectiveId", o.id)}
                />
                <span className={styles.chipText}>{o.title}</span>
              </label>
            ))}
          </div>
          <FieldError id={errorId("objective")} message={errors.objective} />
        </fieldset>

        <fieldset
          className={`${styles.field} ${errors.when ? styles.hasError : ""}`}
        >
          <legend className={styles.label}>When</legend>
          <div className={styles.times}>
            <label className={styles.time}>
              Start
              <input
                id="lt-start"
                data-autofocus={preset ? true : undefined}
                className={styles.input}
                inputMode="numeric"
                autoComplete="off"
                placeholder="09:20"
                maxLength={5}
                value={draft.start}
                onChange={(e) => set("start", fitTime(e.target.value))}
                onBlur={() => tidy("start")}
                {...describedBy(errors.when ? errorId("when") : null)}
              />
            </label>
            <span className={styles.dash} aria-hidden="true">
              –
            </span>
            <label className={styles.time}>
              End
              <input
                id="lt-end"
                className={styles.input}
                inputMode="numeric"
                autoComplete="off"
                placeholder="10:20"
                maxLength={5}
                value={draft.end}
                onChange={(e) => set("end", fitTime(e.target.value))}
                onBlur={() => tidy("end")}
                {...describedBy(errors.when ? errorId("when") : null)}
              />
            </label>
            <button
              type="button"
              className={`${parts.muted} ${styles.now}`}
              onClick={() => {
                const t = nowTimes(new Date(), zone, draft.start);
                set("start", t.start);
                set("end", t.end);
              }}
            >
              Now
            </button>
            <span className={styles.duration} aria-live="polite">
              {durationLabel(draft.start, draft.end)}
            </span>
          </div>
          <FieldError id={errorId("when")} message={errors.when} />
        </fieldset>

        <div
          className={`${styles.field} ${errors.note ? styles.hasError : ""}`}
        >
          <CountedLabel
            htmlFor="lt-note"
            label="What did you do?"
            length={draft.note.length}
            max={noteMax}
          />
          <textarea
            id="lt-note"
            className={styles.textarea}
            maxLength={noteMax}
            value={draft.note}
            onChange={(e) => set("note", e.target.value)}
            // Enter submits the dialog; Shift+Enter is a new line (01-shell.md).
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
            {...describedBy(
              errors.note ? errorId("note") : null,
              chosen ? "lt-hint" : "",
            )}
          />
          <FieldError id={errorId("note")} message={errors.note} />
        </div>

        {chosen ? (
          <p className={styles.hint} id="lt-hint">
            {hint(chosen, minutes, editing)}
          </p>
        ) : null}
      </div>

      <div className={parts.foot}>
        <div className={parts.start}>
          {editing && onDelete ? (
            <button
              type="button"
              className={parts.danger}
              disabled={busy}
              onClick={() => run(() => onDelete(editing))}
            >
              Delete entry
            </button>
          ) : (
            <span className={parts.keys}>esc to close</span>
          )}
        </div>
        <div className={parts.actions}>
          <button
            type="button"
            className={parts.muted}
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={parts.primary}
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {busy ? "Saving…" : buttonLabel(minutes, !!editing)}
          </button>
        </div>
      </div>
    </form>
  );
}
