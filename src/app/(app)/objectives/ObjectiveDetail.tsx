"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { BackIcon } from "@/app/icons";
import type { Objective } from "@/shared/contract";
import { dayLabel } from "@/modules/objectives/domain/newObjective";
import {
  banner,
  footerLine,
  headPill,
  history,
  planLine,
  soFar,
  type Pill as PillValue,
  type Tone,
} from "@/modules/objectives/domain/objectiveView";
import { EffortTab } from "./EffortTab";
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

type TabId = "overview" | "effort";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "effort", label: "Effort" },
];

export function ObjectiveDetail({
  objective: o,
  today,
  backHref,
}: {
  objective: Objective;
  today: string;
  /** Where **‹ Objectives** goes on phone. */
  backHref: string;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow keys move between tabs (01-shell.md); the chosen one takes focus.
  const move = (from: number, by: number) => {
    const to = (from + by + TABS.length) % TABS.length;
    setTab(TABS[to].id);
    tabs.current[to]?.focus();
  };

  return (
    <article className={styles.detail} aria-labelledby="od-title">
      <Link className={styles.back} href={backHref}>
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
          <Overview o={o} today={today} />
        ) : (
          <EffortTab o={o} today={today} />
        )}
      </div>
    </article>
  );
}

function Overview({ o, today }: { o: Objective; today: string }) {
  const b = banner(o, today);
  const s = soFar(o, today);
  const notes = [...o.notes].reverse();
  return (
    <>
      {b ? (
        <div className={`${styles.banner} ${TONE[b.tone]}`}>
          <b>{b.title}</b>
          {b.quote ? <p className={styles.p}>&ldquo;{b.quote}&rdquo;</p> : null}
          {b.note ? <span className={styles.hint}>{b.note}</span> : null}
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

      <div className={styles.blk}>
        <span className={styles.lbl}>Notes</span>
        {notes.length > 0 ? (
          notes.map((n) => (
            <div key={n.id} className={styles.note}>
              <span className={styles.date}>
                {dayLabel(n.written_on, today)}
              </span>
              <p className={styles.p}>{n.text}</p>
            </div>
          ))
        ) : (
          <p className={styles.empty}>No notes yet.</p>
        )}
      </div>

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

      <div className={styles.foot}>
        <p className={styles.fine}>{footerLine(o.status)}</p>
      </div>
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
