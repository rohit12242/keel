"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * A newly added row flashes once (01-shell.md, *List and detail*). `flash`
 * comes from the address (`?created=1`, `?recorded=1`); the address then
 * forgets it, so a reload doesn't flash again. The row's id is kept here,
 * so the flash runs to its end after the parameter has gone. Answers the
 * id of the row to flash, or null.
 */
export function useFlashOnce(
  flash: boolean,
  selected: string | null,
): string | null {
  const router = useRouter();
  const pathname = usePathname();
  const [flashing] = useState(flash ? selected : null);

  useEffect(() => {
    if (flash) router.replace(pathname, { scroll: false });
  }, [flash, pathname, router]);

  return flashing;
}
