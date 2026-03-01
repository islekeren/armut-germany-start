import type { HTMLAttributes } from "react";

type PanelCardProps = HTMLAttributes<HTMLDivElement>;

export function PanelCard({ className = "", ...props }: PanelCardProps) {
  return (
    <div
      className={`rounded-xl bg-white p-6 shadow-sm ${className}`.trim()}
      {...props}
    />
  );
}
