import type { HTMLAttributes } from "react";
import { MASCOT_COLORS, type MascotColorId } from "@/lib/mascot-colors";

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  /** One of the 5 mascot colors (see lib/mascot-colors.ts) — defaults to teal. */
  color?: MascotColorId;
  /** Usually the child's nickname initial. */
  label: string;
  /** Diameter in px — defaults to the comfortable touch-target size. */
  size?: number;
}

/** Wraps the `.kq-avatar-circle` pattern, parameterized by mascot color. */
export function Avatar({ color = "teal", label, size = 64, className, style, ...props }: AvatarProps) {
  const token = MASCOT_COLORS.find((mascot) => mascot.id === color)?.token ?? "--kq-teal";
  return (
    <div
      className={["kq-avatar-circle", className].filter(Boolean).join(" ")}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `var(${token})`,
        boxShadow: "none",
        ...style,
      }}
      aria-hidden="true"
      {...props}
    >
      {label}
    </div>
  );
}
