import type { ProviderOpeningHour } from "@/lib/api";

interface ProviderOpeningHoursProps {
  hours: ProviderOpeningHour[];
  labels: {
    closed: string;
    unknown: string;
    days: Record<string, string>;
  };
}

export function ProviderOpeningHours({
  hours,
  labels,
}: ProviderOpeningHoursProps) {
  if (!hours.length) {
    return <p className="text-sm text-muted">{labels.unknown}</p>;
  }

  return (
    <ul className="space-y-2 text-sm">
      {hours.map((item) => (
        <li key={item.day} className="flex items-center justify-between gap-4">
          <span className="text-foreground">
            {labels.days[item.day] || item.day}
          </span>
          <span className="text-muted">
            {item.closed
              ? labels.closed
              : `${item.open || "--:--"} - ${item.close || "--:--"}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
