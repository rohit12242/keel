"use client";

import Link from "next/link";
import type { ObjectiveSummary, ParkedIdea } from "@/shared/contract";
import {
  filters,
  inFilter,
  type StatusFilter,
} from "@/modules/parking/domain/parkingView";
import { PlusIcon } from "@/app/icons";
import { LogDeviationProvider } from "../LogDeviation";
import { ParkIdeaButton, ParkIdeaProvider } from "../ParkIdea";
import shell from "../shell.module.css";
import layout from "../listDetail.module.css";
import { EmptyLot } from "./EmptyLot";
import { IdeaDetail } from "./IdeaDetail";
import { IdeaList } from "./IdeaList";
import { ParkingHeader } from "./ParkingHeader";
import { datesOf } from "./dates";
import { useHeldVerdict } from "./useHeldVerdict";

/** Where a filter, a row or **‹ Parking lot** goes, keeping the filter. */
export const hrefOf = (filter: StatusFilter, id?: string) =>
  `/parking-lot${id ? `/${id}` : ""}${filter === "all" ? "" : `?status=${filter}`}`;

/**
 * List and detail (01-shell.md): on desktop the filter's ideas beside the
 * open one, the filter with its counts above them (`?status=`);
 * on phone one or the other — `/parking-lot` the list, `/parking-lot/{id}`
 * the detail, with **‹ Parking lot**. `P` parks an idea, and `D` opens
 * Log a deviation here too.
 * Every word comes from `modules/parking/domain`, every date from the API.
 */
export function Screen({
  show,
  ideas,
  objectives,
  filter,
  selected,
  flash = false,
  today,
  zone,
}: {
  show: "list" | "detail";
  ideas: ParkedIdea[];
  objectives: ObjectiveSummary[];
  filter: StatusFilter;
  selected: string | null;
  flash?: boolean;
  today: string;
  zone: string;
}) {
  const dates = datesOf(objectives);
  // A verdict is held until its toast closes; the page shows it at once.
  const verdicts = useHeldVerdict(zone);
  const shown = ideas.map(verdicts.view);
  const open = shown.find((i) => i.id === selected) ?? null;
  return (
    <LogDeviationProvider objectives={dates} today={today} zone={zone}>
      <ParkIdeaProvider objectives={dates} zone={zone}>
        {ideas.length === 0 ? (
          <>
            <ParkingHeader />
            <EmptyLot
              action={
                <ParkIdeaButton className={shell.primary}>
                  <PlusIcon />
                  Park an idea
                </ParkIdeaButton>
              }
            />
          </>
        ) : (
          <div
            className={show === "detail" ? layout.showDetail : layout.showList}
          >
            <div className={layout.listHead}>
              <ParkingHeader />
              <Filters ideas={shown} filter={filter} />
            </div>
            <div className={layout.wrap}>
              <IdeaList
                ideas={inFilter(shown, filter)}
                filter={filter}
                hrefOf={(id) => hrefOf(filter, id)}
                selected={open?.id ?? null}
                flash={flash}
                today={today}
              />
              <div className={layout.detailCol}>
                {open ? (
                  <IdeaDetail
                    key={open.id}
                    idea={open}
                    objectives={dates}
                    today={today}
                    zone={zone}
                    failure={verdicts.failures[open.id]}
                    onVerdict={(v, note) => verdicts.hold(open, v, note)}
                    backHref={hrefOf(filter)}
                  />
                ) : null}
              </div>
            </div>
          </div>
        )}
      </ParkIdeaProvider>
    </LogDeviationProvider>
  );
}

/** All · Parked · Approved · Taken · Dropped with their counts. */
function Filters({
  ideas,
  filter,
}: {
  ideas: readonly ParkedIdea[];
  filter: StatusFilter;
}) {
  return (
    <nav className={layout.filters} aria-label="Filter ideas">
      {filters(ideas).map((f) => (
        <Link
          key={f.id}
          className={layout.filter}
          href={hrefOf(f.id)}
          aria-current={f.id === filter ? "page" : undefined}
        >
          {f.label}
          <span className={layout.count}>{f.count}</span>
        </Link>
      ))}
    </nav>
  );
}
