import Link from "next/link";
import { BackIcon } from "@/app/icons";
import type { Head } from "@/modules/reviews/domain/reviewView";
import { PageHeader } from "../../PageHeader";
import { Pill } from "../ObjectiveDetail";
import form from "../new/newObjective.module.css";
import styles from "./review.module.css";

/**
 * A review page's top (05-reviews.md): the back link, the title, the
 * sub-line and the pill — "Due Sun 6 Sep", "Draft saved · 5 Sep, 18:40" or
 * "Saved Sun 30 Aug, 19:10". `pill` is passed separately so the draft can
 * move it after each autosave.
 */
export function ReviewHead({
  head,
  back,
  pill,
}: {
  head: Head;
  back: { href: string; label: string };
  pill?: React.ReactNode;
}) {
  return (
    <>
      <Link className={form.back} href={back.href}>
        <BackIcon />
        {back.label}
      </Link>
      <PageHeader title={head.title} />
      <div className={styles.top}>
        <span className={styles.sub}>{head.sub}</span>
        {pill ?? <Pill pill={head.pill} />}
      </div>
    </>
  );
}
