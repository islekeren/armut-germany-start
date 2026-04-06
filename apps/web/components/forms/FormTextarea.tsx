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
      className={`w-full rounded-md border-2 border-transparent bg-gray-100 px-4 py-3 text-base text-foreground focus:bg-white focus:outline-none ${accentClass} ${className}`.trim()}
      {...props}
    />
  );
}
