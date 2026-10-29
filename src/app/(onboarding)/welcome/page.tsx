import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { onboardingOpens } from "@/app/onboarding";
import { requireUser } from "../../(app)/requireUser";
import { Onboarding } from "./Onboarding";

export const metadata: Metadata = { title: "Welcome · Keel" };

export const dynamic = "force-dynamic";

/**
 * Onboarding (02-auth-and-onboarding.md), three steps on one page, so Back
 * keeps what was typed and leaving part-way starts again at step 1. An
 * account it doesn't open for — one with an objective, or one that skipped
 * here — goes to Today, which is also where a reload of step 3 lands.
 */
export default async function WelcomePage() {
  const user = await requireUser();
  if (!(await onboardingOpens(user))) redirect("/");
  return <Onboarding name={user.name} userId={user.id} />;
}
