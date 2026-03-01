import type { InputHTMLAttributes } from "react";

type FormAccent = "primary" | "secondary";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  accent?: FormAccent;
}

export function FormInput({
  accent = "primary",
  className = "",
  ...props
}: FormInputProps) {
  const accentClass = accent === "secondary" ? "focus:border-secondary" : "focus:border-primary";

  return (
    <input
      className={`w-full rounded-lg border border-border px-4 py-3 focus:outline-none ${accentClass} ${className}`.trim()}
      {...props}
    />
  );
}
