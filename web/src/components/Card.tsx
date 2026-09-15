import type { HTMLAttributes } from "react";

export type CardProps = HTMLAttributes<HTMLDivElement>;

/** Wraps the `.kq-card` pattern — the base surface for content cards, video tiles, etc. */
export function Card({ className, ...props }: CardProps) {
  return <div className={["kq-card", className].filter(Boolean).join(" ")} {...props} />;
}
