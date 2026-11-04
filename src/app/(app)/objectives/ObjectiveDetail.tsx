"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { BackIcon } from "@/app/icons";
import type { DeviationList, Objective, ReviewList } from "@/shared/contract";
import { deviationTile } from "@/modules/deviations/domain/deviationView";
import { tabCount } from "@/modules/reviews/domain/reviewView";
import { dayLabel } from "@/modules/objectives/domain/newObjective";
import {
  banner,
  headPill,
  history,
  planLine,
  soFar,
  type Pill as PillValue,
  type Tone,
} from "@/modules/objectives/domain/objectiveView";
import { DeviationsTab } from "./DeviationsTab";
import { EffortTab } from "./EffortTab";
import { Notes } from "./Notes";
import { StatusFooter } from "./ReasonDialog";
import { Resume } from "./Resume";
import { DueBanner, ExtensionOwed, ReviewsTab } from "./ReviewsTab";
import type { TabId } from "./tabs";
import list from "../listDetail.module.css";
import styles from "./objectives.module.css";

/**
 * An objective's detail (04-objectives.md, *Detail*): the head, the tabs and
 * the open tab. Every word comes from `modules/objectives/domain`, every
 * figure from the API; `today` is the API's today for this user.
 */

const TONE: Record<Tone, string> = {
  ok: styles.ok,
  risk: styles.risk,
  behind: styles.behind,
  accent: styles.accent,
  neutral: styles.neutral,
};

export function Pill({ pill }: { pill: PillValue }) {
  return (
    <span className={`${styles.pill} ${TONE[pill.tone]}`}>{pill.text}</span>
  );
}

export function ObjectiveDetail({
  objective: o,
  deviations,
  reviews,
  today,
  tz,
  backHref,
  initialTab = "overview",
}: {
  objective: Objective;
  /** Its deviations and their cost; null when they couldn't be read. */
  deviations: DeviationList | null;
  /** Its reviews and what is due; null when they couldn't be read. */
  reviews: ReviewList | null;
  today: string;
  /** The user's zone, for "last edited 5 Sep, 18:40". */
  tz: string;
  /** Where **‹ Objectives** goes on phone. */
  backHref: string;
  initialTab?: TabId;
}) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const count = deviations
    ? deviations.cost.chosen.count + deviations.cost.drifted.count
    : null;
  // "Deviations 2": the label carries the count, when it was read and isn't 0.
  const TABS: { id: TabId; label: string; count?: number | null }[] = [
    { id: "overview", label: "Overview" },
    { id: "effort", label: "Effort" },
    { id: "deviations", label: "Deviations", count },
    // "Reviews 3": saved reviews only, when they were read.
    {
      id: "reviews",
      label: "Reviews",
      count: reviews ? tabCount(reviews.reviews) : null,
    },
  ];
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow keys move between tabs (01-shell.md); the chosen one takes focus.
  const move = (from: number, by: number) => {
    const to = (from + by + TABS.length) % TABS.length;
    setTab(TABS[to].id);
    tabs.current[to]?.focus();
  };

  return (
    <article className={list.detail} aria-labelledby="od-title">
      <Link className={list.back} href={backHref}>
        <BackIcon />
        Objectives
      </Link>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title} id="od-title">
            {o.title}
          </h2>
          <span className={styles.meta}>{planLine(o, today)}</span>
        </div>
        <Pill pill={headPill(o, today)} />
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Objective">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`od-tab-${t.id}`}
            aria-controls="od-panel"
            aria-selected={tab === t.id}
            tabIndex={tab === t.id ? 0 : -1}
            className={styles.tab}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                move(i, 1);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                move(i, -1);
              }
            }}
          >
            {t.label}
            {t.count ? (
              <span className={styles.tabCount}>{t.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div
        className={styles.panel}
        role="tabpanel"
        id="od-panel"
        aria-labelledby={`od-tab-${tab}`}
      >
        {tab === "overview" ? (
          <Overview
            o={o}
            deviations={deviations}
            reviews={reviews}
            today={today}
            tz={tz}
          />
        ) : tab === "effort" ? (
          <EffortTab o={o} today={today} />
        ) : tab === "deviations" ? (
          <DeviationsTab o={o} deviations={deviations} today={today} />
        ) : (
          <ReviewsTab o={o} reviews={reviews} tz={tz} today={today} />
        )}
      </div>
    </article>
  );
}

function Overview({
  o,
  deviations,
  reviews,
  today,
  tz,
}: {
  o: Objective;
  deviations: DeviationList | null;
  reviews: ReviewList | null;
  today: string;
  tz: string;
}) {
  const b = banner(o, today);
  const s = soFar(
    o,
    today,
    deviations ? deviationTile(deviations.cost) : undefined,
  );
  return (
    <>
      <DueBanner o={o} reviews={reviews} today={today} />
      <ExtensionOwed o={o} reviews={reviews} />
      {b ? (
        <div className={`${styles.banner} ${TONE[b.tone]}`}>
          <b>{b.title}</b>
          {b.quote ? <p className={styles.p}>&ldquo;{b.quote}&rdquo;</p> : null}
          {b.note ? <span className={styles.hint}>{b.note}</span> : null}
          {o.status === "paused" ? (
            <Resume o={o} reviews={reviews} tz={tz} />
          ) : null}
        </div>
      ) : null}

      <section className={styles.sec} aria-labelledby="od-sofar">
        <div className={styles.secHead}>
          <h3 id="od-sofar">{s.kind === "figures" ? s.heading : "So far"}</h3>
          {s.kind === "figures" ? (
            <span className={styles.hint}>{s.range}</span>
          ) : null}
        </div>
        {s.kind === "waiting" ? (
          <p className={styles.empty}>{s.text}</p>
        ) : (
          <div className={styles.soFar}>
            <Ring pct={s.ring.pct} tone={s.ring.tone} />
            <div className={styles.tiles}>
              {s.tiles.map((t) => (
                <div key={t.label} className={styles.tile}>
                  <span className={styles.hint}>{t.label}</span>
                  <strong>{t.value}</strong>
                  {t.hint ? (
                    <span className={styles.hint}>{t.hint}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className={styles.blk}>
        <span className={styles.lbl}>Why it matters</span>
        <p className={styles.p}>{o.why_now}</p>
      </div>
      <div className={`${styles.blk} ${styles.crit}`}>
        <span className={styles.lbl}>
          Success criteria · what would prove it worked
        </span>
        <p className={styles.p}>{o.success_criteria}</p>
      </div>

      <Notes
        postTo={`/v1/objectives/${o.id}/notes`}
        notes={o.notes}
        today={today}
        tz={tz}
      />

      <section className={styles.sec} aria-labelledby="od-history">
        <div className={styles.secHead}>
          <h3 id="od-history">Status history</h3>
        </div>
        <ol className={styles.hist}>
          {history(o, today).map((h, i) => (
            <li key={`${h.date}-${i}`}>
              <span className={styles.date}>{dayLabel(h.date, today)}</span>
              <span
                className={`${styles.dot} ${styles[`dot_${h.dot}`]}`}
                aria-hidden="true"
              />
              <div>
                <b>{h.label}</b>
                {h.text ? <p>{h.text}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <StatusFooter o={o} today={today} tz={tz} />
    </>
  );
}

const C = 2 * Math.PI * 42;

/** Adherence as a ring, coloured by the band; no arc at 0 %. */
function Ring({ pct, tone }: { pct: number; tone: Tone }) {
  return (
    <div className={styles.ringWrap}>
      <svg
        className={styles.ring}
        width="104"
        height="104"
        viewBox="0 0 104 104"
        role="img"
        aria-label={`${pct} percent adherence`}
      >
        <circle
          className={styles.ringTrack}
          cx="52"
          cy="52"
          r="42"
          strokeWidth="10"
        />
        {pct > 0 ? (
          <circle
            className={`${styles.ringFill} ${styles[`ring_${tone}`]}`}
            cx="52"
            cy="52"
            r="42"
            strokeWidth="10"
            strokeDasharray={`${((pct / 100) * C).toFixed(1)} ${C.toFixed(1)}`}
            transform="rotate(-90 52 52)"
          />
        ) : null}
        <text
          className={styles.ringLabel}
          x="52"
          y="58"
          textAnchor="middle"
          fontSize="18"
        >
          {pct}%
        </text>
      </svg>
      <span>adherence</span>
    </div>
  );
}
