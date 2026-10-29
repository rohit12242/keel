"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowIcon,
  CheckIcon,
  ClockIcon,
  DeviationsIcon,
  KeelMark,
  ObjectivesIcon,
  ParkingIcon,
  ReviewIcon,
} from "@/app/icons";
import {
  firstObjective,
  ONBOARDING_DRAFT,
  SKIP_COOKIE,
  skipCookie,
  type FirstObjective,
} from "@/modules/onboarding/domain/onboarding";
import type { Draft } from "@/modules/objectives/domain/newObjective";
import {
  formParts,
  NewObjectiveForm,
} from "../../(app)/objectives/new/NewObjectiveForm";
import styles from "./onboarding.module.css";

/**
 * The three steps (02-auth-and-onboarding.md). The rules — the defaults,
 * the skip, what step 3 says — are in `modules/onboarding/domain`; step 2
 * is New objective's own form. The draft is held here, so Back and Next
 * keep it; step 3 draws only what the server returned.
 */

type Step = 1 | 2 | 3;

type Done = { title: string; first: FirstObjective };

/** The skip cookie's value as this browser holds it now. */
function skipValue(): string | undefined {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${SKIP_COOKIE}=`))
    ?.slice(SKIP_COOKIE.length + 1);
}

export function Onboarding({ name, userId }: { name: string; userId: string }) {
  const [step, setStep] = useState<Step>(1);
  const held = useState<Draft>(ONBOARDING_DRAFT);
  const [done, setDone] = useState<Done | null>(null);
  const router = useRouter();
  const title = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  // A new step moves focus to its title, so a screen reader starts there.
  // Not on arrival: the page opens at the top like any other.
  useEffect(() => {
    if (moved.current) title.current?.focus();
    moved.current = true;
  }, [step]);

  const go = (to: Step) => {
    setStep(to);
    window.scrollTo(0, 0);
  };

  function skip() {
    document.cookie = skipCookie(
      skipValue(),
      userId,
      window.location.protocol === "https:",
    );
    router.replace("/");
  }

  return (
    <div className={styles.onb}>
      <header className={styles.top}>
        <div className={styles.brand}>
          <KeelMark />
          <span className={styles.wordmark}>Keel</span>
        </div>
        <div className={styles.steps}>
          {([1, 2, 3] as const).map((i) => (
            <span
              key={i}
              className={`${styles.dot} ${i <= step ? styles.on : ""}`}
              aria-hidden="true"
            />
          ))}
          <span className={styles.stepN}>Step {step} of 3</span>
        </div>
      </header>

      {step === 1 ? (
        <main className={styles.wrap}>
          <div>
            <span className={styles.eyebrow}>
              Welcome, {name.trim() || "there"}
            </span>
            <h1 className={styles.h1} ref={title} tabIndex={-1}>
              How Keel works
            </h1>
            <p className={styles.lead}>
              Keel keeps an honest record of where your time goes, so each
              review runs on evidence instead of memory. Four things make up
              that record.
            </p>
          </div>
          <div className={styles.grid}>
            <Card
              icon={<ObjectivesIcon />}
              tone={styles.obj}
              title="Objectives"
            >
              Something you&rsquo;re working toward, the days you&rsquo;ll give
              it, the time each day or week, and how long it runs.
            </Card>
            <Card icon={<ClockIcon />} tone={styles.eff} title="Effort">
              Log the time you actually spend, start to end, on Today. Keel
              measures it against the plan, day by day.
            </Card>
            <Card
              icon={<DeviationsIcon />}
              tone={styles.dev}
              title="Deviations"
            >
              When time goes somewhere else, record it.{" "}
              <span className={`${styles.pill} ${styles.chosen}`}>Chosen</span>{" "}
              you decided, with a reason.{" "}
              <span className={`${styles.pill} ${styles.drift}`}>Drifted</span>{" "}
              it happened to you.
            </Card>
            <Card icon={<ParkingIcon />} tone={styles.park} title="Parking lot">
              Ideas that pull you away go here. They stay locked until the
              objectives you&rsquo;re running have ended.
            </Card>
          </div>
          <div className={styles.loop}>
            <span className={`${styles.ic} ${styles.obj}`}>
              <ReviewIcon />
            </span>
            <p>
              <b>Then you review.</b> Every week or month you look at the
              numbers, judge the reasons you gave, and set one change to try
              next.
            </p>
          </div>
          <div className={styles.foot}>
            <button type="button" className={styles.skip} onClick={skip}>
              Skip, I&rsquo;ll explore on my own
            </button>
            <button type="button" className={styles.go} onClick={() => go(2)}>
              Next: your first objective
              <ArrowIcon />
            </button>
          </div>
        </main>
      ) : step === 2 ? (
        <main className={`${styles.wrap} ${styles.wide}`}>
          <div>
            <h1 className={styles.h1} ref={title} tabIndex={-1}>
              Your first objective
            </h1>
            <p className={styles.lead}>
              Pick one thing you want to work on now. You can add more
              objectives later.
            </p>
          </div>
          <div className={styles.cols}>
            <div className={styles.form}>
              <NewObjectiveForm
                held={held}
                onCreated={(objective, today) => {
                  setDone({
                    title: objective.title,
                    first: firstObjective(objective, today),
                  });
                  go(3);
                }}
                back={
                  <button
                    type="button"
                    className={formParts.muted}
                    onClick={() => go(1)}
                  >
                    Back
                  </button>
                }
                criteriaExtra={
                  <span className={styles.phoneExamples}>
                    <Examples />
                  </span>
                }
              />
            </div>
            <aside className={styles.tips} aria-label="Tips">
              <div className={styles.tip}>
                <b>Make it small enough to finish</b>
                <p>
                  One skill or one outcome. &ldquo;Learn English&rdquo; is a
                  goal; &ldquo;Conversational English&rdquo; for four weeks is
                  an objective.
                </p>
              </div>
              <div className={styles.tip}>
                <b>Plan the time you really have</b>
                <p>
                  Keel measures you against this every day. A plan you can keep
                  beats an ambitious one you miss.
                </p>
              </div>
              <div className={styles.tip}>
                <b>Write success so you can see it</b>
                <p>
                  At the end you&rsquo;ll mark it Met, Partly met or Not met.
                </p>
                <Examples />
              </div>
            </aside>
          </div>
        </main>
      ) : done ? (
        <main className={`${styles.wrap} ${styles.mid}`}>
          <div>
            <span className={styles.ok}>
              <CheckIcon />
            </span>
            <h1 className={styles.h1} ref={title} tabIndex={-1}>
              You&rsquo;re set.
            </h1>
            <p className={styles.lead}>
              Your first objective starts {done.first.starts}. Here is what it
              asks of you.
            </p>
          </div>
          <section className={styles.card} aria-labelledby="onb-name">
            <span className={styles.hint}>Your objective</span>
            <b className={styles.name} id="onb-name">
              {done.title}
            </b>
            <span className={styles.meta}>{done.first.plan}</span>
            <dl className={styles.tiles}>
              {done.first.tiles.map((t) => (
                <div key={t.label}>
                  <dt>{t.label}</dt>
                  <dd>{t.value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className={styles.card} aria-labelledby="onb-daily">
            <span className={styles.hint} id="onb-daily">
              Each day, on Today
            </span>
            <ul className={styles.rows}>
              <Row
                icon={<ClockIcon />}
                tone={styles.eff}
                title="Log time"
                k="L"
              >
                When a block ends, log its start, end and what you did.
              </Row>
              <Row
                icon={<DeviationsIcon />}
                tone={styles.dev}
                title="Log a deviation"
                k="D"
              >
                When time goes elsewhere, say so: Chosen or Drifted.
              </Row>
              <Row
                icon={<ParkingIcon />}
                tone={styles.park}
                title="Park an idea"
                k="P"
              >
                When a new idea pulls at you, park it and get back to work.
              </Row>
            </ul>
          </section>
          <div className={`${styles.foot} ${styles.footEnd}`}>
            <button
              type="button"
              className={styles.go}
              onClick={() => router.replace("/")}
            >
              Go to Today
              <ArrowIcon />
            </button>
          </div>
        </main>
      ) : null}
    </div>
  );
}

function Card({
  icon,
  tone,
  title,
  children,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.cardSmall}>
      <span className={`${styles.ic} ${tone}`}>{icon}</span>
      <div>
        <b>{title}</b>
        <p>{children}</p>
      </div>
    </div>
  );
}

function Row({
  icon,
  tone,
  title,
  k,
  children,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  k: string;
  children: React.ReactNode;
}) {
  return (
    <li className={styles.row}>
      <span className={`${styles.ic} ${tone}`}>{icon}</span>
      <span>
        <b>{title}</b>
        <span>{children}</span>
      </span>
      <kbd className={styles.kbd}>{k}</kbd>
    </li>
  );
}

/** The hard and easy examples: a tip on desktop, under the hint on phone. */
function Examples() {
  return (
    <>
      <span className={`${styles.ex} ${styles.bad}`}>
        Hard to judge: &ldquo;Get better at English.&rdquo;
      </span>
      <span className={`${styles.ex} ${styles.good}`}>
        Easy to judge: &ldquo;A 15-minute conversation, no switching
        languages.&rdquo;
      </span>
    </>
  );
}
