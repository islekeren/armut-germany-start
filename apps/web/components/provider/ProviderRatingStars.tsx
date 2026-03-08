interface ProviderRatingStarsProps {
  value: number;
  sizeClassName?: string;
}

export function ProviderRatingStars({
  value,
  sizeClassName = "text-base",
}: ProviderRatingStarsProps) {
  const fullStars = Math.max(0, Math.min(5, Math.round(value)));
  const stars = Array.from({ length: 5 }, (_, index) =>
    index < fullStars ? "★" : "☆",
  );

  return (
    <span
      className={`font-medium text-amber-500 ${sizeClassName}`.trim()}
      aria-hidden
    >
      {stars.join("")}
    </span>
  );
}
