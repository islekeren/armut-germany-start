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
      className={`h-12 w-full rounded-md border-2 border-transparent bg-gray-100 px-4 py-3 text-base text-foreground focus:bg-white focus:outline-none ${accentClass} ${className}`.trim()}
      {...props}
    />
  );
}
