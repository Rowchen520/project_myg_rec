import type { InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

/**
 * Primer-styled text input.
 */
export function Input({ className, ...rest }: InputProps) {
  const composed = ["input", className].filter(Boolean).join(" ");
  return <input className={composed} {...rest} />;
}
