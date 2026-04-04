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
      className={`h-12 w-full rounded-md border-2 border-transparent bg-gray-100 px-4 py-3 text-base text-foreground focus:bg-white focus:outline-none ${accentClass} ${className}`.trim()}
      {...props}
    />
  );
}
