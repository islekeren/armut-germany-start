"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { providerApi, ProviderReview } from "@/lib/api";

interface ReviewStats {
  average: number;
  total: number;
  breakdown: Record<number, number>;
}

export default function ReviewsPage() {
  const t = useTranslations("provider.reviews");
  const tNav = useTranslations("provider.dashboard.navigation");
  const locale = useLocale();
  const [reviews, setReviews] = useState<ProviderReview[]>([]);
  const [stats, setStats] = useState<ReviewStats>({
    average: 0,
    total: 0,
    breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const token = localStorage.getItem("armut_access_token");
        if (token) {
          const response = await providerApi.getReviews(token);
          setReviews(response.data);
          setStats(response.stats);
        }
      } catch (error) {
        console.error("Failed to fetch reviews", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, []);

  const handleReply = async (reviewId: string) => {
    try {
      const token = localStorage.getItem("armut_access_token");
      if (token && replyText.trim()) {
        await providerApi.replyToReview(token, reviewId, replyText);
        // Update local state
        setReviews(reviews.map(r => 
          r.id === reviewId ? { ...r, reply: replyText } : r
        ));
        setReplyingTo(null);
        setReplyText("");
      }
    } catch (error) {
      console.error("Failed to reply to review", error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale === "de" ? "de-DE" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        {t("loading") || "Loading..."}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl font-bold text-primary">Armut</span>
              <span className="text-sm text-muted">Pro</span>
            </Link>
            <Link href="/dashboard" className="text-muted hover:text-foreground">
              {tNav("overview")}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-6 text-sm text-muted">
          <Link href="/dashboard" className="hover:text-primary">
            {tNav("overview")}
          </Link>
          {" / "}
          <span>{t("title")}</span>
        </nav>

        <h1 className="mb-8 text-2xl font-bold">{t("title")}</h1>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Stats */}
          <aside>
            <div className="sticky top-8 rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-6 text-center">
                <div className="text-5xl font-bold text-primary">
                  {stats.average.toFixed(1)}
                </div>
                <div className="mt-2 flex justify-center text-2xl text-yellow-500">
                  {"★".repeat(5)}
                </div>
                <div className="mt-1 text-muted">
                  {t("totalReviews", { count: stats.total })}
                </div>
              </div>

              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = stats.breakdown[stars] || 0;
                  const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                  return (
                    <div key={stars} className="flex items-center gap-2">
                      <span className="w-8 text-sm text-muted">{stars} ★</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
                        <div
                          className="h-full bg-yellow-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-sm text-muted">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>

              {stats.average >= 4.5 && (
                <div className="mt-6 rounded-lg bg-green-50 p-4 text-center">
                  <div className="text-lg font-semibold text-green-700">
                    {t("topProvider")}
                  </div>
                  <div className="mt-1 text-sm text-green-600">
                    {t("topProviderDesc")}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Reviews List */}
          <div className="space-y-4 lg:col-span-2">
            {reviews.length === 0 ? (
              <div className="rounded-xl bg-white p-8 text-center shadow-sm">
                <div className="text-4xl mb-4">⭐</div>
                <p className="text-muted">{t("noReviews") || "No reviews yet"}</p>
              </div>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="rounded-xl bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-semibold text-white">
                        {review.customer.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold">{review.customer}</div>
                        <div className="text-sm text-muted">{review.service}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-yellow-500">
                        {"★".repeat(review.rating)}
                        {"☆".repeat(5 - review.rating)}
                      </div>
                      <div className="text-sm text-muted">{formatDate(review.date)}</div>
                    </div>
                  </div>

                  <p className="mt-4 text-muted">{review.comment}</p>

                  {review.reply && (
                    <div className="mt-4 rounded-lg bg-background p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-sm font-medium">{t("yourReply")}</span>
                      </div>
                      <p className="text-sm text-muted">{review.reply}</p>
                    </div>
                  )}

                  {!review.reply && replyingTo !== review.id && (
                    <button 
                      onClick={() => setReplyingTo(review.id)}
                      className="mt-4 text-sm text-primary hover:underline"
                    >
                      {t("reply")}
                    </button>
                  )}

                  {!review.reply && replyingTo === review.id && (
                    <div className="mt-4 space-y-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={t("replyPlaceholder") || "Write your reply..."}
                        className="w-full rounded-lg border border-border p-3 text-sm focus:border-primary focus:outline-none"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleReply(review.id)}
                          className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary-dark"
                        >
                          {t("send") || "Send"}
                        </button>
                        <button 
                          onClick={() => { setReplyingTo(null); setReplyText(""); }}
                          className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-background"
                        >
                          {t("cancel") || "Cancel"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
