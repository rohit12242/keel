"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DeviationsIcon,
  ObjectivesIcon,
  ParkingIcon,
  TodayIcon,
} from "@/app/icons";
import {
  currentPlace,
  PLACES,
  type PlaceId,
} from "@/modules/shell/domain/shell";
import styles from "./shell.module.css";

const ICONS: Record<PlaceId, React.ReactNode> = {
  today: <TodayIcon />,
  objectives: <ObjectivesIcon />,
  deviations: <DeviationsIcon />,
  parking: <ParkingIcon />,
};

/**
 * The four places: the sidebar's list above 860 px, the tab bar at 860 px
 * and below. Only one is ever displayed, so screen readers meet one "Main"
 * navigation. The current place is marked for both sight and `aria-current`.
 */
export function Nav({ variant }: { variant: "side" | "tabs" }) {
  const here = currentPlace(usePathname());
  const item = variant === "side" ? styles.navItem : styles.tab;
  return (
    <nav
      aria-label="Main"
      className={variant === "side" ? styles.nav : styles.tabs}
    >
      {PLACES.map((p) => (
        <Link
          key={p.id}
          href={p.href}
          className={item}
          aria-current={p.id === here ? "page" : undefined}
        >
          {ICONS[p.id]}
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
