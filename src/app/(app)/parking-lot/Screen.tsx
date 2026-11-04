"use client";

import type { ObjectiveSummary, ParkedIdea } from "@/shared/contract";
import { LogDeviationProvider } from "../LogDeviation";
import layout from "../listDetail.module.css";
import { EmptyLot } from "./EmptyLot";
import { IdeaDetail } from "./IdeaDetail";
import { IdeaList } from "./IdeaList";
import { ParkingHeader } from "./ParkingHeader";
import { datesOf } from "./dates";

/**
 * List and detail (01-shell.md): on desktop every idea beside the open one;
 * on phone one or the other — `/parking-lot` the list, `/parking-lot/{id}`
 * the detail, with **‹ Parking lot**. `D` opens Log a deviation here too.
 * Every word comes from `modules/parking/domain`, every date from the API.
 */
export function Screen({
  show,
  ideas,
  objectives,
  selected,
  flash = false,
  today,
  zone,
}: {
  show: "list" | "detail";
  ideas: ParkedIdea[];
  objectives: ObjectiveSummary[];
  selected: string | null;
  flash?: boolean;
  today: string;
  zone: string;
}) {
  const dates = datesOf(objectives);
  const open = ideas.find((i) => i.id === selected) ?? null;
  return (
    <LogDeviationProvider objectives={dates} today={today} zone={zone}>
      {ideas.length === 0 ? (
        <>
          <ParkingHeader />
          <EmptyLot />
        </>
      ) : (
        <div
          className={show === "detail" ? layout.showDetail : layout.showList}
        >
          <div className={layout.listHead}>
            <ParkingHeader />
          </div>
          <div className={layout.wrap}>
            <IdeaList
              ideas={ideas}
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
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </LogDeviationProvider>
  );
}
