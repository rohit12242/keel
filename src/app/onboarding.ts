import { cookies, headers } from "next/headers";
import { getConfig } from "@/config/env";
import {
  opens,
  SKIP_COOKIE,
  skippedBy,
} from "@/modules/onboarding/domain/onboarding";
import type { SessionUser } from "@/shared/contract";

/**
 * Whether onboarding opens for this account, asked by Today and by
 * /welcome alike, so the two can never disagree and send someone between
 * them (G11, I-10). A skip in this browser answers without a read;
 * otherwise `GET /v1/objectives?status=all` counts every objective, with
 * the request's own cookie (D-04). A read that fails is "unknown", which
 * shows Today.
 */
export async function onboardingOpens(user: SessionUser): Promise<boolean> {
  const skipped = skippedBy((await cookies()).get(SKIP_COOKIE)?.value, user.id);
  if (skipped) return false;
  return opens({ objectives: await countObjectives(), skipped });
}

async function countObjectives(): Promise<number | "unknown"> {
  const { appBaseUrl } = getConfig();
  const cookie = (await headers()).get("cookie");
  try {
    const res = await fetch(`${appBaseUrl}/v1/objectives?status=all`, {
      cache: "no-store",
      headers: cookie ? { cookie } : {},
    });
    if (!res.ok) return "unknown";
    const body = (await res.json()) as { objectives?: unknown[] };
    return Array.isArray(body.objectives) ? body.objectives.length : "unknown";
  } catch {
    return "unknown";
  }
}
