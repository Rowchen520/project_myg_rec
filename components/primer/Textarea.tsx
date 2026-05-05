import type { TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

/**
 * Primer-styled textarea.
 */
export function Textarea({ className, ...rest }: TextareaProps) {
  const composed = ["textarea", className].filter(Boolean).join(" ");
  return <textarea className={composed} {...rest} />;
}
