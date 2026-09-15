import { loadConfig } from "@/config/env";

/**
 * Next.js runs this once when the server starts. Validating here makes a
 * misconfigured environment fail immediately at startup — naming the offending
 * variable — rather than surfacing later as a confusing runtime error (W3-11).
 */
export function register() {
  loadConfig();
}
