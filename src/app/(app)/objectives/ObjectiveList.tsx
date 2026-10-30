"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ObjectiveSummary } from "@/shared/contract";
import {
  emptyLine,
  filters,
  inFilter,
  row,
  scheduleLine,
  type Filter,
} from "@/modules/objectives/domain/objectiveView";
import { ObjectivesIcon, PlusIcon } from "@/app/icons";
import { Pill } from "./ObjectiveDetail";
import shell from "../shell.module.css";
import styles from "./objectives.module.css";

/** The four filters with their counts, above the list and the detail. */
export function Filters({
  objectives,
  filter,
}: {
  objectives: ObjectiveSummary[];
  filter: Filter;
}) {
  return (
    <nav className={styles.filters} aria-label="Filter objectives">
      {filters(objectives).map((f) => (
        <Link
          key={f.id}
          className={styles.filter}
          href={`/objectives?status=${f.id}`}
          aria-current={f.id === filter ? "page" : undefined}
        >
          {f.label}
          <span className={styles.count}>{f.count}</span>
        </Link>
      ))}
    </nav>
  );
}

/**
 * The list (04-objectives.md, *List*; 01-shell.md, *List and detail*): the
 * filter's objectives, the latest start first. A row is a link to the objective's own address. `flash` is
 * the row just created: it flashes once, and the address forgets it, so a
 * reload doesn't flash again.
 */
export function ObjectiveList({
  objectives,
  filter,
  selected,
  flash,
  today,
}: {
  objectives: ObjectiveSummary[];
  filter: Filter;
  selected: string | null;
  flash: boolean;
  today: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (flash) router.replace(pathname, { scroll: false });
  }, [flash, pathname, router]);

  const shown = inFilter(objectives, filter);
  return (
    <div className={styles.list}>
      {shown.length === 0 ? (
        <p className={styles.none}>{emptyLine(filter)}</p>
      ) : (
        <ul className={styles.rows}>
          {shown.map((o) => {
            const r = row(o, today);
            return (
              <li key={o.id}>
                <Link
                  className={`${styles.row} ${
                    flash && o.id === selected ? styles.flash : ""
                  }`}
                  href={`/objectives/${o.id}`}
                  aria-current={o.id === selected ? "true" : undefined}
                >
                  <span className={styles.rowTop}>
                    <b>{o.title}</b>
                    {r.due ? (
                      <span className={`${styles.pill} ${styles.due}`}>
                        {r.due}
                      </span>
                    ) : (
                      <Chevron />
                    )}
                  </span>
                  <span className={styles.rowSub}>
                    {scheduleLine(o.schedule)}
                  </span>
                  <span className={styles.prog} aria-hidden="true">
                    <i style={{ width: `${r.progress}%` }} />
                  </span>
                  <span className={styles.rowTop}>
                    <span className={styles.date}>{r.when}</span>
                    <Pill pill={r.pill} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chevron() {
  return (
    <svg
      className={styles.chev}
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

/** No objectives at all: an empty card and the way to New objective. */
export function NoObjectives() {
  return (
    <section className={styles.emptyCard} aria-labelledby="no-objectives">
      <span className={styles.emptyIcon} aria-hidden="true">
        <ObjectivesIcon />
      </span>
      <h2 id="no-objectives">No objectives yet.</h2>
      <p>
        An objective is something you&rsquo;re working toward and the time you
        plan to give it. Keel measures your effort against it, day by day, and
        asks you to review it on a schedule you set.
      </p>
      <ol className={styles.steps}>
        <li>
          <span>1</span>Name it, say why it matters and what success looks like.
        </li>
        <li>
          <span>2</span>Set the days, the time and how long it runs.
        </li>
        <li>
          <span>3</span>Review it every week or month, then decide at the end.
        </li>
      </ol>
      <Link className={shell.primary} href="/objectives/new">
        <PlusIcon />
        New objective
      </Link>
    </section>
  );
}
