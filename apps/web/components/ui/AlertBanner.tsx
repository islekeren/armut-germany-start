import type { ReactNode } from "react";

type AlertVariant = "error" | "warning" | "success" | "info";

interface AlertBannerProps {
  children: ReactNode;
  variant?: AlertVariant;
  className?: string;
}

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  error: "bg-red-50 text-red-700",
  warning: "bg-amber-50 text-amber-700",
  success: "bg-green-50 text-green-700",
  info: "bg-blue-50 text-blue-700",
};

export function AlertBanner({
  children,
  variant = "warning",
  className = "",
}: AlertBannerProps) {
  return (
    <div
      className={`rounded-lg p-3 text-sm font-medium sm:p-4 sm:text-base ${VARIANT_CLASSES[variant]} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
