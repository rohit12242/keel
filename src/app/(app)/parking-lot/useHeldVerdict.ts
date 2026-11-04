"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useToast } from "@/app/toast";
import type { ParkedIdea } from "@/shared/contract";
import { localDayOf } from "@/shared/time/localDay";
import {
  ALREADY_SENT,
  CHANGED_ELSEWHERE,
  heldIdea,
  UNDONE,
  VERDICT_NOT_SAVED,
  verdictBody,
  verdictToast,
  type Verdict,
  type VerdictBody,
} from "@/modules/parking/domain/parkingView";

/** A verdict given and not yet sent. Its identity is the hold itself. */
type Held = { ideaId: string; body: VerdictBody };

/** What the page shows over the API's idea until the API has the verdict. */
type Shown = { held: Held; idea: ParkedIdea };

const without = <T>(map: Record<string, T>, id: string) => {
  const next = { ...map };
  delete next[id];
  return next;
};

/**
 * Your verdict, held until its toast closes (G13, 07-parking-lot.md):
 *
 * - `hold` shows the idea's new state at once and the toast with **Undo**.
 * - The verdict is sent when the toast closes, when another toast replaces
 *   it, when the screen goes (an in-app navigation), or when the page is
 *   closed (`pagehide`, with `keepalive`). One ref says whether anything is
 *   still held, and whoever sends first clears it, so it is sent once.
 * - **Undo** before it is sent cancels it; nothing is sent.
 * - Sends are queued, so two verdicts arrive in the order given.
 * - On 201 the page is read again; on a failure the idea goes back to what
 *   the API has, and says why.
 */
export function useHeldVerdict(zone: string) {
  const router = useRouter();
  const { show } = useToast();
  const [, startTransition] = useTransition();
  const [shown, setShown] = useState<Record<string, Shown>>({});
  const [failures, setFailures] = useState<Record<string, string>>({});
  const held = useRef<Held | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const mounted = useRef(true);

  /** Stop showing `h` over the API's idea — unless a later hold replaced it. */
  const unshow = (h: Held) =>
    setShown((s) => (s[h.ideaId]?.held === h ? without(s, h.ideaId) : s));

  function send(h: Held, keepalive = false) {
    queue.current = queue.current.then(async () => {
      let res: Response | null = null;
      try {
        res = await fetch(`/v1/parked-ideas/${h.ideaId}/verdicts`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(h.body),
          keepalive,
        });
      } catch {
        res = null;
      }
      // Sent as the screen went: there is nothing left to show it on.
      if (!mounted.current) return;
      if (res?.status === 401) {
        router.push("/sign-in");
        return;
      }
      if (res?.status === 201) {
        // The page is read again, and shows what the API now has.
        startTransition(() => {
          router.refresh();
          unshow(h);
        });
        return;
      }
      unshow(h);
      setFailures((f) => ({
        ...f,
        [h.ideaId]: res?.status === 409 ? CHANGED_ELSEWHERE : VERDICT_NOT_SAVED,
      }));
      if (res?.status === 409) startTransition(() => router.refresh());
    });
  }

  /** Send what is held, now. */
  function flush(keepalive = false) {
    const h = held.current;
    if (!h) return;
    held.current = null;
    send(h, keepalive);
  }

  useEffect(() => {
    mounted.current = true;
    const onHide = () => flush(true);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      mounted.current = false;
      // Leaving the screen sends it at once, so it is never lost.
      flush();
    };
    // Mounted once; `flush` reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Give `verdict` on the idea as shown. `note` is a drop's reason. */
  function hold(idea: ParkedIdea, verdict: Verdict, note: string | null) {
    const day = localDayOf(new Date(), zone);
    const h: Held = { ideaId: idea.id, body: verdictBody(verdict, day, note) };
    setFailures((f) => without(f, idea.id));
    // A toast still showing is finished first: its verdict is sent before
    // this one is held.
    show(verdictToast(verdict), {
      undo: async () => {
        if (held.current !== h) return ALREADY_SENT;
        held.current = null;
        unshow(h);
        return UNDONE;
      },
      onDone: () => {
        if (held.current === h) flush();
      },
    });
    held.current = h;
    setShown((s) => ({
      ...s,
      [idea.id]: { held: h, idea: heldIdea(idea, verdict, note, day) },
    }));
  }

  /** The idea as the page shows it: held verdict over the API's. */
  const view = (idea: ParkedIdea): ParkedIdea => {
    const s = shown[idea.id];
    return s ? { ...idea, ...pickVerdict(s.idea) } : idea;
  };

  return { hold, view, failures };
}

/** Only the verdict's fields: the notes and the rest stay the API's. */
const pickVerdict = (i: ParkedIdea) => ({
  verdict: i.verdict,
  verdict_on: i.verdict_on,
  note: i.note,
  decided_early: i.decided_early,
});
