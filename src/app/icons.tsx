/**
 * Keel's icons, inline SVG from the prototype (no icon dependency). Each is
 * decorative: the label beside it carries the meaning.
 */

export function KeelMark() {
  return (
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
  );
}

export function TodayIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="2.2" y="3.2" width="11.6" height="10.6" rx="1.5" />
      <path d="M2.2 6.4h11.6M5.6 1.8v2.4M10.4 1.8v2.4" />
    </svg>
  );
}

export function ObjectivesIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2.2" />
    </svg>
  );
}

export function DeviationsIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 13.2C6 13.2 6.6 3.4 10.6 3.4h2.6" />
      <path d="M11.2 1.6l2.2 1.8-2.2 1.8" />
    </svg>
  );
}

export function ParkingIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="2.2" y="5.4" width="11.6" height="8.4" rx="1.5" />
      <path d="M2.2 5.4l1.6-3.2h8.4l1.6 3.2M6.6 8.8h2.8" />
    </svg>
  );
}
