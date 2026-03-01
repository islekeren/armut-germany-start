import type { SelectHTMLAttributes } from "react";

type FormAccent = "primary" | "secondary";

interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  accent?: FormAccent;
}

export function FormSelect({
  accent = "primary",
  className = "",
  ...props
}: FormSelectProps) {
  const accentClass = accent === "secondary" ? "focus:border-secondary" : "focus:border-primary";

  return (
    <select
      className={`w-full rounded-lg border border-border px-4 py-3 focus:outline-none ${accentClass} ${className}`.trim()}
      {...props}
    />
  );
}
