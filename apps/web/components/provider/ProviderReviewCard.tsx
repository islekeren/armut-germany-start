import type { PublicProviderReviewItem } from "@/lib/api";
import { ProviderRatingStars } from "./ProviderRatingStars";

interface ProviderReviewCardProps {
  review: PublicProviderReviewItem;
  locale: string;
  labels: {
    reviewedOn: string;
    providerReply: string;
    noComment: string;
  };
}

export function ProviderReviewCard({
  review,
  locale,
  labels,
}: ProviderReviewCardProps) {
  const reviewedDate = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(review.createdAt));

  return (
    <article className="rounded-lg border border-border bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-foreground">{review.reviewer.name}</p>
          <p className="text-xs text-muted">
            {labels.reviewedOn}: {reviewedDate}
          </p>
        </div>
        <ProviderRatingStars value={review.rating} />
      </div>

      <p className="mt-2 text-sm text-muted">{review.service.title}</p>
      <p className="mt-3 text-sm text-foreground">
        {review.comment || labels.noComment}
      </p>

      {review.providerReply ? (
        <div className="mt-3 rounded-md bg-background p-3 text-sm">
          <p className="font-medium text-foreground">{labels.providerReply}</p>
          <p className="mt-1 text-muted">{review.providerReply}</p>
        </div>
      ) : null}
    </article>
  );
}
