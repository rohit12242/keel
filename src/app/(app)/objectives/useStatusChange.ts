"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { StatusBody } from "@/modules/objectives/domain/statusActions";

export type Sent = "done" | "failed" | "conflict" | "signed_out";

/**
 * Pause, resume or terminate, sent once whatever the clicks (I-15). The
 * `sending` ref is checked before anything and cleared on every way out;
 * `busy` lives here only, so no second copy outlives a save. After a
 * change the page is read again at the objective's own address, which
 * selects it in the list under its new status; the old page stays until
 * the new one arrives.
 */
export function useStatusChange(objectiveId: string) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const own = `/objectives/${objectiveId}`;

  const reread = () =>
    startTransition(() => {
      if (pathname === own) router.refresh();
      else router.replace(own);
    });

  async function send(body: StatusBody): Promise<Sent | null> {
    if (sending.current) return null;
    sending.current = true;
    setBusy(true);
    let res: Response | null = null;
    try {
      res = await fetch(`/v1/objectives/${objectiveId}/status-changes`, {
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
      return "signed_out";
    }
    if (res?.status === 201) {
      reread();
      return "done";
    }
    if (res?.status === 409) {
      // The status moved on elsewhere: show it as it is now.
      reread();
      return "conflict";
    }
    return "failed";
  }

  return { busy, send };
}
