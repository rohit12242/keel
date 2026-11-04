"use client";

import Link from "next/link";
import { useState } from "react";
import type { ParkedIdea } from "@/shared/contract";
import {
  approvedLine,
  IDEAS_UNREACHABLE,
  ideaMeta,
  NONE_APPROVED,
  search,
  showSearch,
  START_HINT,
  type Origin,
} from "@/modules/parking/domain/startFrom";
import { FieldError } from "../../form";
import { RadioGroup } from "./RadioGroup";
import styles from "./newObjective.module.css";

/** The approved ideas, or that the Parking lot couldn't be read. */
export type Approved = ParkedIdea[] | "unreachable";

const START_ERROR_ID = "nf-start-error";

/**
 * New objective's "Start from" card (04-objectives.md): Scratch or An
 * approved idea, then the ideas to pick from, with search when there's more
 * than one. Picking one fills Name and Why through the form's `onPick`.
 * When the Parking lot can't be read, Scratch is the only way to start.
 */
export function StartFrom({
  ideas,
  origin,
  picked,
  error,
  today,
  onOrigin,
  onPick,
}: {
  ideas: Approved;
  origin: Origin;
  picked: string | null;
  error: string | null;
  today: string;
  onOrigin: (o: Exclude<Origin, null>) => void;
  onPick: (idea: ParkedIdea) => void;
}) {
  const [query, setQuery] = useState("");
  const list = ideas === "unreachable" ? [] : ideas;
  const shown = search(list, query);
  return (
    <section
      className={`${styles.card} ${error ? styles.hasError : ""}`}
      aria-labelledby="nf-start"
    >
      <h2 className={styles.cardTitle} id="nf-start">
        Start from
      </h2>
      <div
        id="nf-start-choices"
        aria-describedby={error ? START_ERROR_ID : undefined}
      >
        <RadioGroup<Exclude<Origin, null>>
          labelledBy="nf-start"
          className={styles.origins}
          optionClass={styles.origin}
          value={origin}
          onChange={onOrigin}
          options={[
            {
              value: "scratch",
              content: (
                <>
                  <b>Scratch</b>
                  <span>A new objective, written from nothing.</span>
                </>
              ),
            },
            ...(ideas === "unreachable"
              ? []
              : [
                  {
                    value: "idea" as const,
                    content: (
                      <>
                        <b>An approved idea</b>
                        <span>{approvedLine(list.length)}</span>
                      </>
                    ),
                  },
                ]),
          ]}
        />
      </div>
      {ideas === "unreachable" ? (
        <p className={styles.hint}>{IDEAS_UNREACHABLE}</p>
      ) : null}
      <FieldError id={START_ERROR_ID} message={error ?? undefined} />

      {origin === "idea" && list.length === 0 ? (
        <p className={styles.hint}>
          {/* The design's words, with "Parking lot" as the link. */}
          {NONE_APPROVED.split("Parking lot")[0]}
          <Link href="/parking-lot">Parking lot</Link>
          {NONE_APPROVED.split("Parking lot")[1]}
        </p>
      ) : null}

      {origin === "idea" && list.length > 0 ? (
        <div className={styles.field}>
          {showSearch(list) ? (
            <input
              type="search"
              className={styles.input}
              placeholder="Search approved ideas"
              aria-label="Search approved ideas"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          ) : null}
          <fieldset className={styles.ideas}>
            <legend className={styles.srOnly}>Approved ideas</legend>
            {shown.map((i) => (
              <label key={i.id} className={styles.idea}>
                <input
                  type="radio"
                  name="nf-idea"
                  className={styles.ideaRadio}
                  checked={picked === i.id}
                  onChange={() => onPick(i)}
                />
                <b>{i.idea}</b>
                <span>{ideaMeta(i, today)}</span>
              </label>
            ))}
          </fieldset>
          <span className={styles.hint}>{START_HINT}</span>
        </div>
      ) : null}
    </section>
  );
}
