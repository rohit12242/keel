import { ToastProvider } from "@/app/toast";
import { FreshOnBack } from "../(app)/FreshOnBack";
import { requireUser } from "../(app)/requireUser";

// The session is read per request, never at build time.
export const dynamic = "force-dynamic";

/**
 * Onboarding's frame (02-auth-and-onboarding.md): signed in, but outside
 * the app's frame — no sidebar, no tab bar. The page draws its own top bar
 * and progress. Without a session, Sign in.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return (
    <ToastProvider>
      <FreshOnBack />
      {children}
    </ToastProvider>
  );
}
