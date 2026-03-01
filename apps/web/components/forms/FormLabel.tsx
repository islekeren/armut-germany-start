import type { LabelHTMLAttributes } from "react";

type LabelSize = "sm" | "base";

interface FormLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  size?: LabelSize;
}

export function FormLabel({
  size = "sm",
  className = "",
  ...props
}: FormLabelProps) {
  const sizeClass = size === "base" ? "text-base" : "text-sm";

  return (
    <label
      className={`mb-2 block font-medium ${sizeClass} ${className}`.trim()}
      {...props}
    />
  );
}
