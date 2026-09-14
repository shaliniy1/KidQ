import type { ButtonHTMLAttributes } from "react";

export interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

/**
 * Wraps the `.kq-pill` pattern — used for duration pickers, category chips,
 * and mode chips throughout the parent flow (P7a duration/time-of-day,
 * Hub interest chips, etc).
 */
export function Pill({ selected = false, className, ...props }: PillProps) {
  return (
    <button
      className={["kq-pill", className].filter(Boolean).join(" ")}
      data-selected={selected ? "true" : "false"}
      aria-pressed={selected}
      {...props}
    />
  );
}
