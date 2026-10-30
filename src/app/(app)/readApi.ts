import { headers } from "next/headers";
import { getConfig } from "@/config/env";

export type Read<T> = { value: T } | "signed_out" | "not_found" | "unreachable";

/**
 * A server page's read of the app's own API, `/v1/...`. The document
 * request's cookie goes along, so the endpoint knows who is asking and the
 * browser fetches nothing (ADR-002, D-04). Every figure the page shows is
 * the endpoint's, as Today's are.
 */
export async function readApi<T>(path: string): Promise<Read<T>> {
  const { appBaseUrl } = getConfig();
  const cookie = (await headers()).get("cookie");
  try {
    const res = await fetch(`${appBaseUrl}/v1${path}`, {
      cache: "no-store",
      headers: cookie ? { cookie } : {},
    });
    if (res.status === 401) return "signed_out";
    if (res.status === 404) return "not_found";
    if (!res.ok) return "unreachable";
    return { value: (await res.json()) as T };
  } catch {
    return "unreachable";
  }
}
