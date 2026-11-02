import type { ImprovementAnswer, Review, ReviewWrite } from "@/shared/contract";
import { TEXT_MAX } from "@/modules/objectives/domain/newObjective";
import type { Verdict } from "./reviewView";

/**
 * The weekly or monthly review as a form (`05-reviews.md`), pure: the
 * answers a draft holds, the checks **Save review** runs, the body autosave
 * sends, and the page's words. Verdicts are written one at a time by their
 * own request; they are checked here, never sent (I-13).
 */

/** Each Reflect field's limit on screen (G7); the contract allows 4000. */
export const REFLECT_MAX = TEXT_MAX;

export type Answers = {
  improvement_answer: ImprovementAnswer | null;
  what_worked: string;
  what_got_in_the_way: string;
  what_changes_next: string;
};

export type ReflectField =
  "what_worked" | "what_got_in_the_way" | "what_changes_next";

export const REFLECT: readonly {
  field: ReflectField;
  label: (unit: "week" | "month") => string;
  placeholder?: string;
  hint?: string;
}[] = [
  { field: "what_worked", label: () => "What worked" },
  { field: "what_got_in_the_way", label: () => "What got in the way" },
  {
    field: "what_changes_next",
    label: (unit) => `What changes next ${unit}`,
    placeholder: "One change you can try.",
    hint: "One change. You'll check it at the next review.",
  },
];

/** The draft's answers as the form holds them: text, never null. */
export const answersOf = (r: Review): Answers => ({
  improvement_answer: r.improvement_answer,
  what_worked: r.what_worked ?? "",
  what_got_in_the_way: r.what_got_in_the_way ?? "",
  what_changes_next: r.what_changes_next ?? "",
});

/** What autosave sends: the answers as typed, an empty field as null. */
export const patchBody = (a: Answers): ReviewWrite => ({
  improvement_answer: a.improvement_answer,
  what_worked: a.what_worked === "" ? null : a.what_worked,
  what_got_in_the_way:
    a.what_got_in_the_way === "" ? null : a.what_got_in_the_way,
  what_changes_next: a.what_changes_next === "" ? null : a.what_changes_next,
});

export const sameAnswers = (a: Answers, b: Answers): boolean =>
  a.improvement_answer === b.improvement_answer &&
  a.what_worked === b.what_worked &&
  a.what_got_in_the_way === b.what_got_in_the_way &&
  a.what_changes_next === b.what_changes_next;

/** Whether card 2 asks "How did it go?": there is a change to check. */
export const hasChange = (r: Pick<Review, "previous_what_changes_next">) =>
  (r.previous_what_changes_next ?? "").trim() !== "";

/** The Chosen deviations this review judges: not judged by another review. */
export const toJudge = (r: Pick<Review, "id" | "deviations">): string[] =>
  r.deviations
    .filter(
      (d) =>
        d.kind === "chosen" &&
        (d.verdict_review_id === null || d.verdict_review_id === r.id),
    )
    .map((d) => d.id);

/** The verdicts this review has given, by deviation, as stored. */
export const verdictsOf = (
  r: Pick<Review, "id" | "deviations">,
): Record<string, Verdict | null> =>
  Object.fromEntries(
    r.deviations
      .filter((d) => toJudge(r).includes(d.id))
      .map((d) => [d.id, d.verdict]),
  );

/** A field the check can point at: an answer, or a deviation's verdict. */
export type Field = "improvement_answer" | ReflectField | `verdict:${string}`;

export const ERRORS = {
  improvement_answer: "Say how last change went.",
  verdict: "Mark whether the reasoning held.",
  what_worked: "Write what worked, even if it was small.",
  what_got_in_the_way: "Write what got in the way.",
  what_changes_next: "Set one change to try next.",
} as const;

export type Checked =
  | { ok: true }
  | { ok: false; errors: Partial<Record<Field, string>>; first: Field };

/** Every problem at once, in page order, in the design's words. */
export function checkReview(
  a: Answers,
  verdicts: Record<string, Verdict | null>,
  r: Pick<Review, "id" | "deviations" | "previous_what_changes_next">,
): Checked {
  const errors: Partial<Record<Field, string>> = {};
  const order: Field[] = [];
  const fail = (field: Field, message: string) => {
    errors[field] = message;
    order.push(field);
  };
  if (hasChange(r) && a.improvement_answer === null) {
    fail("improvement_answer", ERRORS.improvement_answer);
  }
  for (const id of toJudge(r)) {
    if (!verdicts[id]) fail(`verdict:${id}`, ERRORS.verdict);
  }
  for (const { field } of REFLECT) {
    if (a[field].trim() === "") fail(field, ERRORS[field]);
  }
  return order.length === 0
    ? { ok: true }
    : { ok: false, errors, first: order[0] };
}

/** After saving: "Week 2 review saved." and " 1 more due." when another waits. */
export const savedToast = (title: string, moreDue: number): string =>
  `${title} saved.${moreDue > 0 ? ` ${moreDue} more due.` : ""}`;

export const BAR_NOTE = "A saved review can't be changed.";
export const DRAFT_SAVED = "Draft saved. Continue it from Reviews.";
export const DISCARD_ASK =
  "Discard this draft? Its answers are deleted, and the review stays due.";
export const DISCARDED = "Draft discarded. The review is still due.";
export const NOT_SAVED =
  "Couldn't save the review. Your answers are kept as a draft. Try again.";
export const NOT_DISCARDED = "Couldn't discard the draft. Try again.";
export const NOT_AUTOSAVED =
  "Couldn't save the draft just now. Your answers are still here.";
export const VERDICT_FAILED = "Couldn't save that. Try again.";
export const JUDGED_ELSEWHERE =
  "An earlier review already judged this deviation.";
export const NOTHING_TO_CHECK =
  "First review of this objective, so there is no earlier change to check.";
export const LOCK_NOTE =
  "Kept exactly as written. A saved review can't be edited or deleted.";
export const RECOMPUTED = "Recomputed from the record";
