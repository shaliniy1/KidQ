import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/**
 * Wraps the `.kq-primary-button` / `.kq-secondary-button` patterns from
 * kidq-design-tokens.css. Every screen's primary/secondary CTA should use
 * this instead of a bare <button> so button styling stays in one place.
 */
export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  const variantClass = variant === "primary" ? "kq-primary-button" : "kq-secondary-button";
  return <button className={[variantClass, className].filter(Boolean).join(" ")} {...props} />;
}
