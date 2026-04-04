import type { HTMLAttributes } from "react";

type PanelCardProps = HTMLAttributes<HTMLDivElement>;

export function PanelCard({ className = "", ...props }: PanelCardProps) {
  return (
    <div
      className={`rounded-lg border-2 border-blue-200 bg-white p-4 shadow-none transition-colors duration-200 hover:border-blue-400 sm:p-6 md:hover:scale-[1.01] ${className}`.trim()}
      {...props}
    />
  );
}
