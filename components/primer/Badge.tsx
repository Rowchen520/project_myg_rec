import type { HTMLAttributes, ReactNode } from "react";

export type BadgeTone = "default" | "accent" | "success" | "attention" | "danger" | "done";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

/**
 * Compact pill used to convey status, type, or risk level.
 */
export function Badge({ tone = "default", className, children, ...rest }: BadgeProps) {
  const composed = ["badge", className].filter(Boolean).join(" ");
  return (
    <span className={composed} data-tone={tone} {...rest}>
      {children}
    </span>
  );
}
