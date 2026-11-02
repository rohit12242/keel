/**
 * An objective's tabs, and `?tab=` read into one. A plain module, not the
 * client detail's: a server page calls `tabOf`, and a server component can't
 * call a function exported from a `"use client"` file.
 */
export type TabId = "overview" | "effort" | "deviations" | "reviews";

/** `?tab=`: the tab the page opens on, Overview by default. */
export const tabOf = (param: string | undefined): TabId =>
  param === "effort" || param === "deviations" || param === "reviews"
    ? param
    : "overview";
