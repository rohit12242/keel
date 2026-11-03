"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Review, ReviewWrite } from "@/shared/contract";
import { latestWriter, type LatestWriter } from "./latestWriter";

/** What a form's answers send, and when two sets are the same write. */
export type Codec<A> = {
  body: (a: A) => ReviewWrite;
  same: (a: A, b: A) => boolean;
};

/** Typing autosaves once it pauses this long (G10). */
const PAUSE_MS = 1000;

/**
 * A draft's answers, saved as the user goes (G10, plan step 5): a choice at
 * once, typing a second after it pauses. One PATCH is in flight at a time and
 * only the newest answers wait (`latestWriter`), so an older write never lands
 * last. `flush` writes what is pending now and waits for it — Save draft and
 * Save review call it first. Leaving the page — closing it or following a
 * link — sends what is pending with `keepalive`, unless `stop` was called
 * because the page is being left on purpose (saved or discarded). `codec`
 * says what the answers send: a weekly review's, or a final review's (I-14).
 * Pass a module-level constant: a new one each render would re-run the
 * page-leave effect, whose cleanup sends what is pending.
 */
export function useAutosave<A>(
  review: Pick<Review, "id">,
  initial: A,
  onSaved: (lastSavedAt: string | null) => void,
  codec: Codec<A>,
) {
  const { body, same } = codec;
  const router = useRouter();
  const url = `/v1/reviews/${review.id}`;
  const latest = useRef(initial);
  const saved = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(false);
  const [failed, setFailed] = useState(false);
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  // Made on first use, in a handler, never while rendering.
  const writerRef = useRef<LatestWriter<A> | null>(null);
  const writer = useCallback((): LatestWriter<A> => {
    writerRef.current ??= latestWriter<A>(async (a) => {
      const res = await fetch(url, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body(a)),
      });
      if (res.status === 401) {
        router.push("/sign-in");
        return false;
      }
      if (!res.ok) {
        setFailed(true);
        return false;
      }
      saved.current = a;
      setFailed(false);
      const r = (await res.json().catch(() => null)) as Review | null;
      onSavedRef.current(r?.last_saved_at ?? null);
      return true;
    });
    return writerRef.current;
  }, [url, router, body]);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const change = useCallback(
    (a: A, now = false) => {
      latest.current = a;
      clearTimer();
      if (now) writer().want(a);
      else
        timer.current = setTimeout(
          () => writer().want(latest.current),
          PAUSE_MS,
        );
    },
    [writer],
  );

  /** Write what is pending now; true once the newest answers are saved. */
  const flush = useCallback((): Promise<boolean> => {
    clearTimer();
    if (!same(latest.current, saved.current)) {
      writer().want(latest.current);
    }
    return writer().flush();
  }, [writer, same]);

  /** The page is being left on purpose: nothing more is sent. */
  const stop = useCallback(() => {
    clearTimer();
    stopped.current = true;
  }, []);

  useEffect(() => {
    const sendPending = () => {
      if (stopped.current || same(latest.current, saved.current)) return;
      clearTimer();
      void fetch(url, {
        method: "PATCH",
        credentials: "same-origin",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body(latest.current)),
      }).catch(() => {});
      saved.current = latest.current;
    };
    window.addEventListener("pagehide", sendPending);
    return () => {
      window.removeEventListener("pagehide", sendPending);
      // A client-side navigation unmounts the form without a pagehide.
      sendPending();
    };
  }, [url, body, same]);

  return { change, flush, stop, failed };
}
