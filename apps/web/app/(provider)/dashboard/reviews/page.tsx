"use client";

import Link from "next/link";

const mockReviews = [
  {
    id: "1",
    customer: "Anna Müller",
    rating: 5,
    date: "10. Januar 2026",
    service: "Fensterreinigung",
    comment:
      "Hervorragende Arbeit! Die Fenster glänzen wie neu. Sehr pünktlich und professionell. Kann ich nur weiterempfehlen!",
    reply: null,
  },
  {
    id: "2",
    customer: "Thomas Weber",
    rating: 5,
    date: "5. Januar 2026",
    service: "Büroreinigung",
    comment:
      "Sehr zufrieden mit dem Service. Sauber, gründlich und zuverlässig. Werden wir wieder buchen.",
    reply:
      "Vielen Dank für Ihre positive Bewertung! Wir freuen uns auf die weitere Zusammenarbeit.",
  },
  {
    id: "3",
    customer: "Sarah Klein",
    rating: 4,
    date: "28. Dezember 2025",
    service: "Grundreinigung",
    comment:
      "Gute Reinigung insgesamt. Ein kleiner Bereich wurde übersehen, aber nach Hinweis sofort erledigt.",
    reply:
      "Danke für Ihr Feedback! Wir arbeiten ständig daran, uns zu verbessern.",
  },
  {
    id: "4",
    customer: "Michael Braun",
    rating: 5,
    date: "20. Dezember 2025",
    service: "Umzugsreinigung",
    comment:
      "Perfekt! Die Wohnung war wie neu als sie fertig waren. Habe meine Kaution vollständig zurückbekommen.",
    reply: null,
  },
];

const ratingStats = {
  average: 4.9,
  total: 127,
  breakdown: {
    5: 112,
    4: 13,
    3: 2,
    2: 0,
    1: 0,
  },
};

export default function ReviewsPage() {
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
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-6 text-sm text-muted">
          <Link href="/dashboard" className="hover:text-primary">
            Dashboard
          </Link>
          {" / "}
          <span>Reviews</span>
        </nav>

        <h1 className="mb-8 text-2xl font-bold">My Reviews</h1>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Stats */}
          <aside>
            <div className="sticky top-8 rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-6 text-center">
                <div className="text-5xl font-bold text-primary">
                  {ratingStats.average}
                </div>
                <div className="mt-2 flex justify-center text-2xl text-yellow-500">
                  {"★".repeat(5)}
                </div>
                <div className="mt-1 text-muted">
                  {ratingStats.total} Bewertungen
                </div>
              </div>

              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = ratingStats.breakdown[stars as keyof typeof ratingStats.breakdown];
                  const percentage = (count / ratingStats.total) * 100;
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

              <div className="mt-6 rounded-lg bg-green-50 p-4 text-center">
                <div className="text-lg font-semibold text-green-700">
                  Top Dienstleister
                </div>
                <div className="mt-1 text-sm text-green-600">
                  Sie gehören zu den besten 10% in Ihrer Kategorie!
                </div>
              </div>
            </div>
          </aside>

          {/* Reviews List */}
          <div className="space-y-4 lg:col-span-2">
            {mockReviews.map((review) => (
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
                    <div className="text-sm text-muted">{review.date}</div>
                  </div>
                </div>

                <p className="mt-4 text-muted">{review.comment}</p>

                {review.reply && (
                  <div className="mt-4 rounded-lg bg-background p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-sm font-medium">Ihre Antwort</span>
                    </div>
                    <p className="text-sm text-muted">{review.reply}</p>
                  </div>
                )}

                {!review.reply && (
                  <button className="mt-4 text-sm text-primary hover:underline">
                    Antworten
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
