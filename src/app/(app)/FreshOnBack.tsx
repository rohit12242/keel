"use client";

import { useEffect } from "react";

/**
 * A signed-in page the browser brings back from its back/forward cache was
 * never asked of the server, so after Sign out, Back would show the frame
 * again. Reloading such a page lets the server decide: Sign in without a
 * session, the page as it is now with one.
 */
export function FreshOnBack() {
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) window.location.reload();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);
  return null;
}
