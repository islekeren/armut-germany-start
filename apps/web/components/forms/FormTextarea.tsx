import type { TextareaHTMLAttributes } from "react";

type FormAccent = "primary" | "secondary";

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  accent?: FormAccent;
}

export function FormTextarea({
  accent = "primary",
  className = "",
  ...props
}: FormTextareaProps) {
  const accentClass = accent === "secondary" ? "focus:border-secondary" : "focus:border-primary";

  return (
    <textarea
      className={`w-full rounded-lg border border-border px-4 py-3 focus:outline-none ${accentClass} ${className}`.trim()}
      {...props}
    />
  );
}
