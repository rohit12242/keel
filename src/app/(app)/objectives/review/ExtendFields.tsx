"use client";

import type { Objective } from "@/shared/contract";
import {
  CADENCE_HINT,
  changedFrom,
  extendDraft,
  extendPreview,
  isCurrent,
  REASON_MAX,
  REASON_PLACEHOLDER,
  SCHEDULE_HINT,
  type ExtendDraft,
  type FinalField,
} from "@/modules/reviews/domain/finalReview";
import { CountedLabel, describedBy, FieldError } from "../../form";
import { onlyDigits, Segments, WEEKDAYS } from "../new/NewObjectiveForm";
import { ERR } from "./ReviewCards";
import form from "../new/newObjective.module.css";
import styles from "./review.module.css";

/**
 * Extend's fields (05-reviews.md, *What next*): how long, the schedule for
 * the extra time filled in from the current plan, its review cadence, and
 * why. Fixed only (I-09). The preview's dates are `extensionSpan`'s, the
 * server's rule. The final review shows these under Extend it; the saved
 * final review shows them again for Make the extension (G49).
 */
export function ExtendFields({
  objective: o,
  draft: d,
  onChange,
  errors,
  today,
}: {
  objective: Objective;
  draft: ExtendDraft;
  onChange: (d: ExtendDraft) => void;
  errors: Partial<Record<FinalField, string>>;
  today: string;
}) {
  const set = <K extends keyof ExtendDraft>(k: K, v: ExtendDraft[K]) =>
    onChange({ ...d, [k]: v });
  const changed = changedFrom(d, o);
  const err = (f: FinalField) => (errors[f] ? ERR(f) : null);
  const mark = (f: FinalField) =>
    `${form.field} ${errors[f] ? form.hasError : ""}`;
  return (
    <div className={styles.extend}>
      <div className={mark("extend_length")}>
        <span className={form.label} id="rv-extend-length-label">
          Extend by
        </span>
        <div
          className={form.hm}
          role="group"
          aria-labelledby="rv-extend-length-label"
        >
          <input
            id="rv-extend_length"
            className={`${form.input} ${form.num}`}
            inputMode="numeric"
            maxLength={2}
            aria-label="How many"
            value={d.length}
            onChange={(e) => set("length", onlyDigits(e.target.value))}
            {...describedBy(err("extend_length"), "rv-extend-preview")}
          />
          <Segments
            label="Unit"
            value={d.unit}
            onChange={(v) => set("unit", v)}
            options={[
              ["weeks", "Weeks"],
              ["months", "Months"],
            ]}
          />
        </div>
        <span className={form.hint} id="rv-extend-preview">
          {extendPreview(o, d, today)}
        </span>
        <FieldError id={ERR("extend_length")} message={errors.extend_length} />
      </div>

      <div className={styles.extendHead}>
        <span className={form.label}>Schedule for the extension</span>
        <span className={form.hint}>{SCHEDULE_HINT}</span>
      </div>

      <div className={mark("extend_days")}>
        <span className={form.label} id="rv-extend-days-label">
          Fixed weekdays
        </span>
        <div
          className={form.days}
          role="group"
          aria-labelledby="rv-extend-days-label"
          {...describedBy(err("extend_days"), "rv-extend-days-hint")}
        >
          {WEEKDAYS.map(([n, name], i) => {
            const on = d.weekdays.includes(n);
            return (
              <button
                key={n}
                id={i === 0 ? "rv-extend_days" : undefined}
                type="button"
                role="checkbox"
                aria-checked={on}
                className={form.chip}
                onClick={() =>
                  set(
                    "weekdays",
                    on ? d.weekdays.filter((x) => x !== n) : [...d.weekdays, n],
                  )
                }
              >
                {name}
              </button>
            );
          })}
        </div>
        <span className={form.hint} id="rv-extend-days-hint">
          {changed.days}
        </span>
        <FieldError id={ERR("extend_days")} message={errors.extend_days} />
      </div>

      <div className={mark("extend_target")}>
        <span className={form.label} id="rv-extend-target-label">
          Target each planned day
        </span>
        <div
          className={form.hm}
          role="group"
          aria-labelledby="rv-extend-target-label"
        >
          <input
            id="rv-extend_target"
            className={`${form.input} ${form.num}`}
            inputMode="numeric"
            maxLength={2}
            aria-label="Hours"
            value={d.hours}
            onChange={(e) => set("hours", onlyDigits(e.target.value))}
            {...describedBy(err("extend_target"))}
          />
          <span className={form.unit}>h</span>
          <input
            className={`${form.input} ${form.num}`}
            inputMode="numeric"
            maxLength={2}
            aria-label="Minutes"
            value={d.minutes}
            onChange={(e) => set("minutes", onlyDigits(e.target.value))}
            {...describedBy(err("extend_target"))}
          />
          <span className={form.unit}>m</span>
          {changed.target ? (
            <span className={form.hint}>{changed.target}</span>
          ) : null}
        </div>
        <FieldError id={ERR("extend_target")} message={errors.extend_target} />
      </div>

      <div className={form.field}>
        <span className={form.label} id="rv-extend-cadence-label">
          Review every
        </span>
        <Segments
          labelledBy="rv-extend-cadence-label"
          value={d.cadence}
          onChange={(v) => set("cadence", v)}
          options={[
            ["weekly", "Week"],
            ["monthly", "Month"],
          ]}
        />
        <span className={form.hint}>{CADENCE_HINT}</span>
      </div>

      <div>
        <button
          type="button"
          className={form.muted}
          disabled={isCurrent(d, o)}
          onClick={() => {
            const now = extendDraft(o);
            onChange({
              ...d,
              weekdays: now.weekdays,
              hours: now.hours,
              minutes: now.minutes,
              cadence: now.cadence,
            });
          }}
        >
          Reset to the current schedule
        </button>
      </div>

      <div className={mark("extend_reason")}>
        <CountedLabel
          htmlFor="rv-extend_reason"
          label="Why extend"
          length={d.reason.length}
          max={REASON_MAX}
        />
        <textarea
          id="rv-extend_reason"
          className={form.textarea}
          maxLength={REASON_MAX}
          placeholder={REASON_PLACEHOLDER}
          value={d.reason}
          onChange={(e) => set("reason", e.target.value)}
          {...describedBy(err("extend_reason"))}
        />
        <FieldError id={ERR("extend_reason")} message={errors.extend_reason} />
      </div>
    </div>
  );
}
