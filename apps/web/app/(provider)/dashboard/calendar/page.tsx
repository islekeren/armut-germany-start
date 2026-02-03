"use client";

import { useState } from "react";
import Link from "next/link";

const daysOfWeek = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const mockEvents = [
  {
    id: "1",
    title: "Fensterreinigung",
    customer: "Anna Müller",
    date: "2026-01-15",
    time: "10:00",
    duration: 2,
    status: "confirmed",
    address: "Hauptstraße 12, 10115 Berlin",
  },
  {
    id: "2",
    title: "Büroreinigung",
    customer: "Thomas Weber",
    date: "2026-01-17",
    time: "09:00",
    duration: 4,
    status: "pending",
    address: "Friedrichstraße 45, 10117 Berlin",
  },
  {
    id: "3",
    title: "Grundreinigung",
    customer: "Sarah Klein",
    date: "2026-01-20",
    time: "14:00",
    duration: 3,
    status: "confirmed",
    address: "Schönhauser Allee 78, 10439 Berlin",
  },
];

export default function CalendarPage() {
  const [currentDate] = useState(new Date(2026, 0, 1));
  const [selectedDate, setSelectedDate] = useState<string | null>("2026-01-15");

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = (firstDay.getDay() + 6) % 7; // Monday = 0

    const days = [];
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const days = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  const getEventsForDate = (day: number | null) => {
    if (!day) return [];
    const dateStr = `2026-01-${day.toString().padStart(2, "0")}`;
    return mockEvents.filter((e) => e.date === dateStr);
  };

  const selectedEvents = selectedDate
    ? mockEvents.filter((e) => e.date === selectedDate)
    : [];

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
          <span>Calendar</span>
        </nav>

        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Kalender</h1>
          <div className="flex gap-2">
            <button className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-background">
              Heute
            </button>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary-dark">
              Verfügbarkeit einstellen
            </button>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <button className="rounded-lg p-2 hover:bg-background">
                  ←
                </button>
                <h2 className="text-xl font-semibold capitalize">{monthName}</h2>
                <button className="rounded-lg p-2 hover:bg-background">
                  →
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {daysOfWeek.map((day) => (
                  <div
                    key={day}
                    className="py-2 text-center text-sm font-medium text-muted"
                  >
                    {day}
                  </div>
                ))}
                {days.map((day, index) => {
                  const events = getEventsForDate(day);
                  const dateStr = day
                    ? `2026-01-${day.toString().padStart(2, "0")}`
                    : null;
                  const isSelected = dateStr === selectedDate;
                  const isToday = day === 2; // Mock: today is Jan 2

                  return (
                    <div
                      key={index}
                      onClick={() => dateStr && setSelectedDate(dateStr)}
                      className={`min-h-24 cursor-pointer rounded-lg border p-2 transition ${
                        day
                          ? isSelected
                            ? "border-primary bg-primary/5"
                            : "border-transparent hover:bg-background"
                          : ""
                      }`}
                    >
                      {day && (
                        <>
                          <div
                            className={`mb-1 text-sm ${
                              isToday
                                ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white"
                                : ""
                            }`}
                          >
                            {day}
                          </div>
                          {events.map((event) => (
                            <div
                              key={event.id}
                              className={`mb-1 truncate rounded px-1 py-0.5 text-xs ${
                                event.status === "confirmed"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {event.time} {event.title}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Selected Day Details */}
          <aside>
            <div className="sticky top-8 rounded-xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-semibold">
                {selectedDate
                  ? new Date(selectedDate).toLocaleDateString("de-DE", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })
                  : "Datum auswählen"}
              </h3>

              {selectedEvents.length > 0 ? (
                <div className="space-y-4">
                  {selectedEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg border border-border p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{event.title}</h4>
                          <p className="text-sm text-muted">{event.customer}</p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            event.status === "confirmed"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {event.status === "confirmed" ? "Bestätigt" : "Ausstehend"}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1 text-sm text-muted">
                        <div>🕐 {event.time} Uhr ({event.duration}h)</div>
                        <div>📍 {event.address}</div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button className="flex-1 rounded-lg border border-border py-2 text-sm hover:bg-background">
                          Details
                        </button>
                        <button className="flex-1 rounded-lg bg-primary py-2 text-sm text-white hover:bg-primary-dark">
                          Nachricht
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted">
                  <div className="mb-2 text-4xl">📅</div>
                  <p>Keine Termine an diesem Tag</p>
                </div>
              )}

              <button className="mt-4 w-full rounded-lg border border-border py-2 text-sm hover:bg-background">
                + Termin hinzufügen
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
