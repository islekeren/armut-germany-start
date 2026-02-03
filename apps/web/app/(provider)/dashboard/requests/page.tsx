"use client";

import { useState } from "react";
import Link from "next/link";

const mockRequests = [
  {
    id: "1",
    title: "Wohnung reinigen lassen (80qm)",
    category: "Reinigung",
    description:
      "Brauche eine gründliche Reinigung meiner 3-Zimmer-Wohnung. Küche und Bad besonders gründlich.",
    location: "10115 Berlin",
    date: "Flexibel",
    budget: "100-150€",
    postedAt: "Vor 2 Stunden",
    customer: {
      name: "Anna M.",
      memberSince: "2024",
    },
  },
  {
    id: "2",
    title: "Badezimmer renovieren",
    category: "Renovierung",
    description:
      "Komplette Renovierung eines kleinen Badezimmers (6qm). Neue Fliesen, Sanitäranlagen.",
    location: "10117 Berlin",
    date: "Ab Februar",
    budget: "2000-3500€",
    postedAt: "Vor 5 Stunden",
    customer: {
      name: "Thomas W.",
      memberSince: "2023",
    },
  },
  {
    id: "3",
    title: "Garten winterfest machen",
    category: "Garten",
    description:
      "Garten (200qm) muss winterfest gemacht werden. Hecken schneiden, Laub entfernen.",
    location: "10119 Berlin",
    date: "Diese Woche",
    budget: "150-250€",
    postedAt: "Vor 1 Tag",
    customer: {
      name: "Sarah K.",
      memberSince: "2025",
    },
  },
  {
    id: "4",
    title: "Elektrische Installation prüfen",
    category: "Elektriker",
    description:
      "Alte Elektrik in Altbauwohnung überprüfen und ggf. erneuern. Sicherungskasten modernisieren.",
    location: "10405 Berlin",
    date: "Nächste Woche",
    budget: "500-1000€",
    postedAt: "Vor 1 Tag",
    customer: {
      name: "Michael B.",
      memberSince: "2024",
    },
  },
];

export default function RequestsPage() {
  const [filter, setFilter] = useState("alle");
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);

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
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-muted hover:text-foreground"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-muted">
          <Link href="/dashboard" className="hover:text-primary">
            Dashboard
          </Link>
          {" / "}
          <span>Requests</span>
        </nav>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Open Requests</h1>
            <p className="text-muted">
              {mockRequests.length} requests in your service area
            </p>
          </div>
          <div className="flex gap-2">
            {["alle", "reinigung", "renovierung", "garten"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${
                  filter === f
                    ? "bg-primary text-white"
                    : "bg-white text-muted hover:bg-background"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Requests List */}
          <div className="space-y-4 lg:col-span-2">
            {mockRequests.map((request) => (
              <div
                key={request.id}
                onClick={() => setSelectedRequest(request.id)}
                className={`cursor-pointer rounded-xl bg-white p-6 shadow-sm transition hover:shadow-md ${
                  selectedRequest === request.id ? "ring-2 ring-primary" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {request.category}
                    </span>
                    <h3 className="mt-2 text-lg font-semibold">
                      {request.title}
                    </h3>
                  </div>
                  <span className="text-sm text-muted">{request.postedAt}</span>
                </div>

                <p className="mt-2 line-clamp-2 text-muted">
                  {request.description}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 text-muted">
                    📍 {request.location}
                  </span>
                  <span className="flex items-center gap-1 text-muted">
                    📅 {request.date}
                  </span>
                  <span className="font-semibold text-secondary">
                    💰 {request.budget}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium text-white">
                      {request.customer.name.charAt(0)}
                    </div>
                    <div className="text-sm">
                      <div className="font-medium">{request.customer.name}</div>
                      <div className="text-muted">
                        Mitglied seit {request.customer.memberSince}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Open quote modal
                    }}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                  >
                    Angebot senden
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-8 rounded-xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-semibold">Tipps für bessere Angebote</h3>
              <ul className="space-y-3 text-sm text-muted">
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  Antworten Sie schnell - frühe Angebote werden eher angenommen
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  Seien Sie spezifisch bei der Preisgestaltung
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  Erwähnen Sie Ihre relevante Erfahrung
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  Stellen Sie Rückfragen wenn nötig
                </li>
              </ul>

              <div className="mt-6 rounded-lg bg-secondary/10 p-4">
                <div className="text-2xl font-bold text-secondary">87%</div>
                <div className="text-sm text-muted">
                  Ihrer Angebote wurden bisher angenommen
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
