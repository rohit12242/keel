"use client";

import { configureAuth } from "@/modules/session/browser";

/**
 * Points Amplify at the pool the server named for this request (ADR-004:
 * nothing about the environment is baked into the build).
 */
export function AuthProvider({
  cognito,
  children,
}: {
  cognito: { poolId: string; clientId: string };
  children: React.ReactNode;
}) {
  // Only the browser talks to Cognito; the server render has nothing to set.
  if (typeof window !== "undefined") configureAuth(cognito);
  return children;
}
