import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getConfig } from "@/config/env";
import { zoneOf } from "@/modules/session/service";
import { localDayOf } from "@/shared/time/localDay";
import type { Day } from "@/shared/contract";
import { longDate } from "@/modules/today/domain/todayView";
import { PageHeader } from "../PageHeader";
import { requireUser } from "../requireUser";
import { Today } from "./Today";
import styles from "./today.module.css";

export const metadata: Metadata = { title: "Today · Keel" };

// Server-rendered per request (D-04), fetched from the real endpoint.
export const dynamic = "force-dynamic";

type Fetched = { day: Day } | "signed_out" | "unreachable";

/**
 * The document request's own cookie goes along, so the server knows who is
 * asking without the browser fetching anything (ADR-002, D-04).
 */
async function fetchDay(date: string): Promise<Fetched> {
  const { appBaseUrl } = getConfig();
  const cookie = (await headers()).get("cookie");
  try {
    const res = await fetch(`${appBaseUrl}/v1/day/${date}`, {
      cache: "no-store",
      headers: cookie ? { cookie } : {},
    });
    if (res.status === 401) return "signed_out";
    if (!res.ok) return "unreachable";
    return { day: (await res.json()) as Day };
  } catch {
    return "unreachable";
  }
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const user = await requireUser();
  const { reset } = await searchParams;
  // Today in the zone the user last signed in from (I-07). It takes no date
  // from the URL: every recorded date still comes from the client (NFR-12).
  const zone = await zoneOf(user.id);
  if (!zone) redirect("/sign-in");
  const day = localDayOf(new Date(), zone);
  const fetched = await fetchDay(day);

  // The session ended between the frame's check and the fetch.
  if (fetched === "signed_out") redirect("/sign-in");

  if (fetched === "unreachable") {
    // Error state: the endpoint could not be read (e.g. the database is down).
    return (
      <>
        <PageHeader eyebrow={longDate(day)} title="Today" />
        <div className={styles.error} role="alert">
          <strong>Couldn&rsquo;t reach your log.</strong> The day for {day}{" "}
          could not be loaded. Nothing has been lost — try again in a moment.
        </div>
      </>
    );
  }

  return <Today day={fetched.day} zone={zone} reset={reset === "done"} />;
}
