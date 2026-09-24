/** "vor 3 Stunden" / "3 hours ago", "jetzt" / "now". */
export function formatRelativeTime(value: string | Date, locale: string) {
  const diffMinutes = Math.floor(
    (Date.now() - new Date(value).getTime()) / 60_000,
  );
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (diffMinutes >= 60 * 24) {
    return formatter.format(-Math.floor(diffMinutes / (60 * 24)), "day");
  }
  if (diffMinutes >= 60) {
    return formatter.format(-Math.floor(diffMinutes / 60), "hour");
  }
  if (diffMinutes >= 1) {
    return formatter.format(-diffMinutes, "minute");
  }
  return formatter.format(0, "second");
}
