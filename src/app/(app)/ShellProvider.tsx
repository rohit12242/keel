"use client";

import { createContext, useContext } from "react";
import type { Theme } from "@/modules/shell/domain/shell";

export type Me = { name: string; initial: string };

type Shell = { me: Me; savedTheme: Theme | null };

const ShellContext = createContext<Shell | null>(null);

/**
 * Hands what the server knows to the frame's client parts — the page
 * header's account menu, Today's loading and error states, the theme
 * switches — which the layout cannot pass props to: who is signed in, and
 * the theme the cookie held when the page was rendered.
 */
export function ShellProvider({
  me,
  savedTheme,
  children,
}: Shell & { children: React.ReactNode }) {
  return (
    <ShellContext.Provider value={{ me, savedTheme }}>
      {children}
    </ShellContext.Provider>
  );
}

function useShell(): Shell {
  const shell = useContext(ShellContext);
  if (!shell) throw new Error("used outside ShellProvider");
  return shell;
}

export function useMe(): Me {
  return useShell().me;
}

export function useSavedTheme(): Theme | null {
  return useShell().savedTheme;
}
