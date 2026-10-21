import { Geist } from "next/font/google";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getConfig } from "@/config/env";
import { signedInUser } from "@/modules/session/service";
import { AuthProvider } from "./AuthProvider";
import styles from "./auth.module.css";
import "./modern.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

// The session and the Cognito ids are read per request, never at build time.
export const dynamic = "force-dynamic";

/**
 * The sign-in screens' frame (02-auth-and-onboarding.md): the hero on the
 * left, the card on the right, a violet band on phone. The server hands the
 * browser the pool and client ids at runtime, so one build runs in every
 * environment (ADR-004). Someone already signed in goes straight to Today.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (signedInUser((await headers()).get("cookie"), new Date())) redirect("/");
  const { poolId, clientId } = getConfig().cognito;

  return (
    <div data-look="modern" className={`${geist.variable} ${styles.auth}`}>
      <svg className={styles.rings} viewBox="0 0 760 760" aria-hidden="true">
        <circle className={styles.ringTrack} cx="380" cy="380" r="340" />
        <circle
          className={styles.ringA}
          cx="380"
          cy="380"
          r="340"
          strokeDasharray="1666 2136"
          transform="rotate(-90 380 380)"
        />
        <circle className={styles.ringTrack} cx="380" cy="380" r="270" />
        <circle
          className={styles.ringB}
          cx="380"
          cy="380"
          r="270"
          strokeDasharray="1154 1696"
          transform="rotate(-90 380 380)"
        />
      </svg>

      <div className={styles.brand}>
        <svg
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 1.8v11" />
          <path d="M3.4 8.6c0 3.1 2.5 5.6 5.6 7.6 3.1-2 5.6-4.5 5.6-7.6" />
          <path d="M5.8 4.8h6.4" />
        </svg>
        <span className={styles.wordmark}>Keel</span>
      </div>

      <div className={styles.body}>
        <div className={styles.hero}>
          <p className={styles.heroTitle}>
            The <span className={styles.hl}>evidence</span>, not guesswork,
            decides what you do next.
          </p>
          <p className={styles.heroSub}>
            Keel keeps a daily trail of your effort and what pulled you off it.
          </p>
          <ul className={styles.keeps} aria-label="What Keel keeps">
            <li>
              <span className={`${styles.dot} ${styles.dotEffort}`} />
              Effort against your plan
            </li>
            <li>
              <span className={`${styles.dot} ${styles.dotDeviation}`} />
              Deviations you declare
            </li>
            <li>
              <span className={`${styles.dot} ${styles.dotAccent}`} />
              Ideas you parked
            </li>
          </ul>
        </div>

        <main className={styles.card}>
          <AuthProvider cognito={{ poolId, clientId }}>{children}</AuthProvider>
        </main>
      </div>

      <p className={styles.foot}>
        A private record of your time. Never shared.
      </p>
    </div>
  );
}
