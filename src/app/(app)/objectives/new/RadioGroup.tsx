"use client";

import { useRef } from "react";

/**
 * Buttons that act as one radio group: the chosen one is in the Tab order
 * (the first, while none is), and the arrow keys move the choice
 * (01-shell.md).
 */
export function RadioGroup<T extends string | number>({
  label,
  labelledBy,
  options,
  value,
  onChange,
  className,
  optionClass,
}: {
  label?: string;
  labelledBy?: string;
  options: { value: T; content: React.ReactNode }[];
  value: T | null;
  onChange: (v: T) => void;
  className: string;
  optionClass: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (from: number, by: number) => {
    const to = (from + by + options.length) % options.length;
    onChange(options[to].value);
    refs.current[to]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      className={className}
    >
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={
            o.value === value ||
            (i === 0 && !options.some((x) => x.value === value))
              ? 0
              : -1
          }
          className={optionClass}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              e.preventDefault();
              move(i, 1);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              e.preventDefault();
              move(i, -1);
            }
          }}
        >
          {o.content}
        </button>
      ))}
    </div>
  );
}
