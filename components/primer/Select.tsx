import type { SelectHTMLAttributes } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

/**
 * Primer-styled native select.
 */
export function Select({ className, children, ...rest }: SelectProps) {
  const composed = ["select", className].filter(Boolean).join(" ");
  return (
    <select className={composed} {...rest}>
      {children}
    </select>
  );
}
