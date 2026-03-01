import type { ReactNode } from "react";

type AlertVariant = "error" | "warning" | "success" | "info";

interface AlertBannerProps {
  children: ReactNode;
  variant?: AlertVariant;
  className?: string;
}

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  error: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  success: "border-green-200 bg-green-50 text-green-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
};

export function AlertBanner({
  children,
  variant = "warning",
  className = "",
}: AlertBannerProps) {
  return (
    <div
      className={`rounded-lg border p-4 ${VARIANT_CLASSES[variant]} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
