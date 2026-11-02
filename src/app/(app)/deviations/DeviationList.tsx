"use client";

import Link from "next/link";
import {
  emptyFilter,
  type KindFilter,
  type Row,
} from "@/modules/deviations/domain/deviationView";
import { useFlashOnce } from "../useFlashOnce";
import { KindPill } from "./KindPill";
import layout from "../listDetail.module.css";
import styles from "./deviations.module.css";

/**
 * This week's list (06-deviations.md, *Row*), newest first. A row is a link
 * to the deviation's own address. `flash` is the row just recorded: it
 * flashes once, and the address forgets it.
 */
export function DeviationList({
  rows,
  filter,
  selected,
  flash,
}: {
  rows: (Row & { href: string })[];
  filter: KindFilter;
  selected: string | null;
  flash: boolean;
}) {
  const flashing = useFlashOnce(flash, selected);
  return (
    <div className={layout.list}>
      {rows.length === 0 ? (
        <p className={layout.none}>
          {filter === "all" ? null : emptyFilter(filter)}
        </p>
      ) : (
        <ul className={layout.rows}>
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                className={`${layout.row} ${r.id === flashing ? layout.flash : ""}`}
                href={r.href}
                aria-current={r.id === selected ? "true" : undefined}
              >
                <span className={styles.rowTop}>
                  <span className={styles.date}>{r.meta}</span>
                  <KindPill kind={r.kind} />
                </span>
                <span className={styles.rowTop}>
                  <b className={styles.rowText}>{r.text}</b>
                  <Chevron />
                </span>
                <span className={styles.dur}>{r.duration}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
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
