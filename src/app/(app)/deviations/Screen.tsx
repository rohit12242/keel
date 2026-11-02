import Link from "next/link";
import {
  detail,
  filters,
  inFilter,
  row,
  weekBox,
  type Cost,
  type KindFilter,
} from "@/modules/deviations/domain/deviationView";
import type { WeekRead } from "./read";
import { DeviationDetail } from "./DeviationDetail";
import { DeviationList } from "./DeviationList";
import { DeviationsHeader, EmptyWeek } from "./DeviationsHeader";
import layout from "../listDetail.module.css";
import styles from "./deviations.module.css";

/** Where a filter, a row or **‹ Deviations** goes, keeping the filter. */
const hrefOf = (filter: KindFilter, id?: string) =>
  `/deviations${id ? `/${id}` : ""}${filter === "all" ? "" : `?kind=${filter}`}`;

/**
 * List and detail (01-shell.md): on desktop this week's list beside the
 * open deviation; on phone one or the other — `/deviations` the list,
 * `/deviations/{id}` the detail, with **‹ Deviations**. Every word comes
 * from `modules/deviations/domain`, every figure from the API.
 */
export function Screen({
  show,
  read,
  filter,
  selected,
  flash = false,
  today,
}: {
  show: "list" | "detail";
  read: Exclude<WeekRead, string>;
  filter: KindFilter;
  selected: string | null;
  flash?: boolean;
  today: string;
}) {
  const { week, list, objectives, patterns } = read;
  const names = new Map(objectives.map((o) => [o.id, o.title]));
  const header = <DeviationsHeader range={week.range} />;
  if (list.deviations.length === 0) {
    return (
      <>
        {header}
        <EmptyWeek />
      </>
    );
  }
  const open = list.deviations.find((d) => d.id === selected) ?? null;
  return (
    <div className={show === "detail" ? layout.showDetail : layout.showList}>
      <div className={layout.listHead}>
        {header}
        <div className={styles.bar}>
          <Filters cost={list.cost} filter={filter} />
          <WeekBox cost={list.cost} />
        </div>
      </div>
      <div className={layout.wrap}>
        <DeviationList
          rows={inFilter(list.deviations, filter).map((d) => ({
            ...row(d, names, today),
            href: hrefOf(filter, d.id),
          }))}
          filter={filter}
          selected={open?.id ?? null}
          flash={flash}
        />
        <div className={layout.detailCol}>
          {open ? (
            <DeviationDetail
              key={open.id}
              detail={detail(open, names, patterns, today)}
              backHref={hrefOf(filter)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** All · Chosen · Drifted with their counts. */
function Filters({ cost, filter }: { cost: Cost; filter: KindFilter }) {
  return (
    <nav className={layout.filters} aria-label="Filter deviations">
      {filters(cost).map((f) => (
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

/** "Off plan this week 6h 15m | Chosen 5h 00m | Drifted 1h 15m". */
function WeekBox({ cost }: { cost: Cost }) {
  const w = weekBox(cost);
  return (
    <div className={styles.week} role="group" aria-label="Off plan this week">
      <span className={styles.weekLabel}>Off plan this week</span>
      <span className={styles.weekAll}>{w.all}</span>
      <span className={styles.sep} aria-hidden="true" />
      <span className={`${styles.wk} ${styles.wkChosen}`}>
        Chosen <span className={styles.m}>{w.chosen}</span>
      </span>
      <span className={`${styles.wk} ${styles.wkDrifted}`}>
        Drifted <span className={styles.m}>{w.drifted}</span>
      </span>
    </div>
  );
}

export function Unreachable() {
  return (
    <>
      <DeviationsHeader range={null} />
      <div className={styles.error} role="alert">
        <strong>Couldn&rsquo;t reach your deviations.</strong> Nothing has been
        lost — try again in a moment.
      </div>
    </>
  );
}
