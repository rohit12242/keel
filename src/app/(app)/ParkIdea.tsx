"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useToast } from "@/app/toast";
import type { ParkedIdea, ParkedIdeaList } from "@/shared/contract";
import { localDayOf } from "@/shared/time/localDay";
import {
  checkIdea,
  IDEA_MAX,
  lockNote,
  NOT_PARKED,
  parkedToast,
  WHY_MAX,
  type IdeaDraft,
  type IdeaField,
} from "@/modules/parking/domain/parkIdea";
import type { ObjectiveDates } from "@/modules/parking/domain/parkingView";
import { Dialog, dialogParts as parts } from "./Dialog";
import { CountedLabel, describedBy, errorIdOf, FieldError } from "./form";
import { useShortcut } from "./shortcuts";
import styles from "./parkIdea.module.css";

/**
 * Park an idea (07-parking-lot.md). The provider sits on each page that
 * offers it — the Parking lot, Today — holds whether the dialog is open,
 * and answers `P` there. `ParkIdeaButton` opens it from anywhere inside.
 * The checks, the lock note and the toast are in
 * `modules/parking/domain/parkIdea.ts`; this draws them and sends.
 */

type Context = { open: () => void };

const ParkContext = createContext<Context>({ open: () => {} });

export function ParkIdeaProvider({
  objectives,
  zone,
  shortcut = true,
  children,
}: {
  /** For the lock note's name: the objective whose end sets the lock. */
  objectives: readonly ObjectiveDates[];
  /** The user's zone: the day an idea is caught. */
  zone: string;
  /** Whether `P` opens it on this page. */
  shortcut?: boolean;
  children: React.ReactNode;
}) {
  const [opened, setOpened] = useState(false);
  // Held here only: the form reports it, and every way out clears it.
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { show } = useToast();
  const open = () => setOpened(true);
  const close = () => {
    setBusy(false);
    setOpened(false);
  };

  useShortcut("p", () => {
    if (shortcut) open();
  });

  return (
    <ParkContext.Provider value={{ open }}>
      {children}
      <Dialog open={opened} title="Park an idea" onClose={close} busy={busy}>
        {opened ? (
          <ParkIdeaForm
            objectives={objectives}
            zone={zone}
            onClose={close}
            onBusy={setBusy}
            onParked={(idea, today) => {
              // Every hold cleared, then the Parking lot with the new idea.
              close();
              show(parkedToast(idea, today));
              router.push(`/parking-lot/${idea.id}?parked=1`);
            }}
          />
        ) : null}
      </Dialog>
    </ParkContext.Provider>
  );
}

/** A button that opens Park an idea. */
export function ParkIdeaButton({
  className,
  children,
  ...rest
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type">) {
  const { open } = useContext(ParkContext);
  return (
    <button type="button" className={className} onClick={open} {...rest}>
      {children}
    </button>
  );
}

const errorId = (f: IdeaField) => errorIdOf("pi", f);

function ParkIdeaForm({
  objectives,
  zone,
  onClose,
  onBusy,
  onParked,
}: {
  objectives: readonly ObjectiveDates[];
  zone: string;
  onClose: () => void;
  onBusy: (busy: boolean) => void;
  onParked: (idea: ParkedIdea, today: string) => void;
}) {
  const router = useRouter();
  const [today] = useState(() => localDayOf(new Date(), zone));
  const [draft, setDraft] = useState<IdeaDraft>({ idea: "", why: "" });
  const [errors, setErrors] = useState<Partial<Record<IdeaField, string>>>({});
  const [until, setUntil] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusyHere] = useState(false);
  const [shaking, setShaking] = useState(false);
  // Set before the request, so a second click or Enter sends nothing.
  const sending = useRef(false);
  const setBusy = (b: boolean) => {
    setBusyHere(b);
    onBusy(b);
  };

  // The lock a new idea would get, from the API (G38), read when it opens.
  // If it can't be read, the note is left out; parking still works.
  useEffect(() => {
    let live = true;
    fetch(`/v1/parked-ideas?caught_on=${today}`, { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json()) as ParkedIdeaList;
        if (live) setUntil(body.new_idea_locked_until ?? null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [today]);

  const note = lockNote(today, until, objectives);

  const set = (field: IdeaField, value: string) => {
    setDraft((d) => ({ ...d, [field]: value }));
    if (errors[field]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[field];
        return next;
      });
    }
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending.current) return;
    // The day it is caught is the day it is sent, in the user's zone.
    const day = localDayOf(new Date(), zone);
    const checked = checkIdea(draft, day);
    if (!checked.ok) {
      setErrors(checked.errors);
      setShaking(true);
      document.getElementById(`pi-${checked.first}`)?.focus();
      return;
    }
    setErrors({});
    setFailed(null);
    sending.current = true;
    setBusy(true);
    let res: Response | null = null;
    try {
      res = await fetch("/v1/parked-ideas", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(checked.body),
      });
    } catch {
      res = null;
    }
    if (res?.status === 401) {
      onBusy(false);
      router.push("/sign-in");
      return;
    }
    if (res?.status === 201) {
      // The form is left, so `sending` stays set: nothing more is sent.
      onParked((await res.json()) as ParkedIdea, day);
      return;
    }
    // Everything typed stays; nothing was parked.
    sending.current = false;
    setBusy(false);
    setFailed(NOT_PARKED);
  }

  /** Enter submits from a textarea; Shift+Enter is a new line (01-shell.md). */
  const enterSubmits = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  const fieldClass = (f: IdeaField) =>
    `${styles.field} ${errors[f] ? styles.hasError : ""}`;

  return (
    <form
      className={`${parts.form} ${shaking ? parts.shake : ""}`}
      noValidate
      onSubmit={submit}
      onAnimationEnd={() => setShaking(false)}
      aria-busy={busy || undefined}
    >
      <div className={parts.body}>
        <p className={styles.sub}>
          Write it down so you can stop thinking about it. You&rsquo;ll decide
          on it later.
        </p>
        {failed ? (
          <p className={styles.banner} role="alert">
            {failed}
          </p>
        ) : null}

        <div className={fieldClass("idea")}>
          <CountedLabel
            htmlFor="pi-idea"
            label="The idea"
            length={draft.idea.length}
            max={IDEA_MAX}
          />
          <input
            id="pi-idea"
            className={styles.input}
            maxLength={IDEA_MAX}
            autoComplete="off"
            placeholder="What's pulling at you?"
            data-autofocus
            value={draft.idea}
            onChange={(e) => set("idea", e.target.value)}
            {...describedBy(errors.idea ? errorId("idea") : null)}
          />
          <FieldError id={errorId("idea")} message={errors.idea} />
        </div>

        <div className={fieldClass("why")}>
          <CountedLabel
            htmlFor="pi-why"
            label="Why it grabbed you"
            length={draft.why.length}
            max={WHY_MAX}
          />
          <textarea
            id="pi-why"
            className={styles.textarea}
            maxLength={WHY_MAX}
            rows={3}
            value={draft.why}
            onChange={(e) => set("why", e.target.value)}
            onKeyDown={enterSubmits}
            {...describedBy(errors.why ? errorId("why") : null, "pi-why-hint")}
          />
          <p className={styles.hint} id="pi-why-hint">
            Be honest. You&rsquo;ll read this again when you decide.
          </p>
          <FieldError id={errorId("why")} message={errors.why} />
        </div>

        {note ? (
          <p
            className={`${styles.lock} ${note.tone === "caution" ? styles.caution : styles.muted}`}
          >
            {note.text}
          </p>
        ) : null}
      </div>

      <div className={parts.foot}>
        <div className={parts.start}>
          <span className={parts.keys}>esc to close</span>
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
            {busy ? "Parking…" : "Park it"}
          </button>
        </div>
      </div>
    </form>
  );
}
