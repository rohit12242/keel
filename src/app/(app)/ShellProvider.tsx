"use client";

import { createContext, useContext } from "react";

export type Me = { name: string; initial: string };

const MeContext = createContext<Me | null>(null);

/**
 * Hands the signed-in person's name to the frame's client parts — the page
 * header's account menu, and Today's loading and error states — which the
 * layout cannot pass props to.
 */
export function ShellProvider({
  me,
  children,
}: {
  me: Me;
  children: React.ReactNode;
}) {
  return <MeContext.Provider value={me}>{children}</MeContext.Provider>;
}

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe outside ShellProvider");
  return me;
}
