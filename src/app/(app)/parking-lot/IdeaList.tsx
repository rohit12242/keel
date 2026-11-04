"use client";

import Link from "next/link";
import type { ParkedIdea } from "@/shared/contract";
import { caught, pill } from "@/modules/parking/domain/parkingView";
import { useFlashOnce } from "../useFlashOnce";
import layout from "../listDetail.module.css";
import { IdeaPill } from "./IdeaPill";
import styles from "./parkingLot.module.css";

/**
 * Every idea (07-parking-lot.md, *Row*), newest caught first, no filter. A
 * row is a link to the idea's own address. `flash` is the idea just parked:
 * it flashes once, and the address forgets it.
 */
export function IdeaList({
  ideas,
  selected,
  flash,
  today,
}: {
  ideas: readonly ParkedIdea[];
  selected: string | null;
  flash: boolean;
  today: string;
}) {
  const flashing = useFlashOnce(flash, selected);
  return (
    <div className={layout.list}>
      <ul className={layout.rows}>
        {ideas.map((i) => {
          const p = pill(i, today);
          return (
            <li key={i.id}>
              <Link
                className={`${layout.row} ${i.id === flashing ? layout.flash : ""}`}
                href={`/parking-lot/${i.id}`}
                aria-current={i.id === selected ? "true" : undefined}
              >
                <span className={styles.rowTop}>
                  <b className={styles.rowText}>{i.idea}</b>
                  <Chevron />
                </span>
                <span className={styles.rowTop}>
                  <span className={styles.date}>{caught(i, today)}</span>
                  <IdeaPill
                    pill={p}
                    text={p.row}
                    info={
                      <span className={styles.infoMark} aria-hidden="true">
                        ⓘ
                      </span>
                    }
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Chevron() {
  return (
    <svg
      className={layout.chev}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 3.5L10.5 8 6 12.5" />
    </svg>
  );
}
