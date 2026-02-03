"use client";

import { useState } from "react";
import Link from "next/link";

const categories = [
  "Reinigung",
  "Umzug",
  "Renovierung",
  "Garten",
  "Elektriker",
  "Klempner",
];

export default function ProviderProfilePage() {
  const [formData, setFormData] = useState({
    companyName: "Mustermann Services",
    contactName: "Max Mustermann",
    email: "max@mustermann-services.de",
    phone: "+49 30 12345678",
    description:
      "Professionelle Reinigungsdienste seit über 10 Jahren. Wir bieten höchste Qualität und Zuverlässigkeit für Privat- und Geschäftskunden.",
    categories: ["Reinigung"],
    postalCode: "10115",
    city: "Berlin",
    serviceRadius: "25",
    priceMin: "25",
    priceMax: "50",
    experienceYears: "10",
    website: "www.mustermann-services.de",
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

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

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-6 text-sm text-muted">
          <Link href="/dashboard" className="hover:text-primary">
            Dashboard
          </Link>
          {" / "}
          <span>Edit Profile</span>
        </nav>

        <h1 className="mb-8 text-2xl font-bold">Edit Profile</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Info */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Firmeninformationen</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Firmenname *
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) =>
                    setFormData({ ...formData, companyName: e.target.value })
                  }
                  className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Ansprechpartner *
                </label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) =>
                    setFormData({ ...formData, contactName: e.target.value })
                  }
                  className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">
                  E-Mail *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Telefon *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium">
                Beschreibung *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={4}
                className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                required
              />
              <p className="mt-1 text-sm text-muted">
                Beschreiben Sie Ihre Dienstleistungen und Erfahrung
              </p>
            </div>
          </div>

          {/* Services */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Services</h2>
            <div>
              <label className="mb-2 block text-sm font-medium">
                Kategorien *
              </label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((cat) => (
                  <label
                    key={cat}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 hover:border-primary"
                  >
                    <input
                      type="checkbox"
                      checked={formData.categories.includes(cat)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            categories: [...formData.categories, cat],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            categories: formData.categories.filter(
                              (c) => c !== cat
                            ),
                          });
                        }
                      }}
                      className="rounded border-border"
                    />
                    <span>{cat}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Erfahrung (Jahre)
                </label>
                <input
                  type="number"
                  value={formData.experienceYears}
                  onChange={(e) =>
                    setFormData({ ...formData, experienceYears: e.target.value })
                  }
                  className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Preis ab (€/Std)
                </label>
                <input
                  type="number"
                  value={formData.priceMin}
                  onChange={(e) =>
                    setFormData({ ...formData, priceMin: e.target.value })
                  }
                  className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Preis bis (€/Std)
                </label>
                <input
                  type="number"
                  value={formData.priceMax}
                  onChange={(e) =>
                    setFormData({ ...formData, priceMax: e.target.value })
                  }
                  className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Servicegebiet</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Postleitzahl *
                </label>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) =>
                    setFormData({ ...formData, postalCode: e.target.value })
                  }
                  className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Stadt *</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                  className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Service-Radius (km)
                </label>
                <select
                  value={formData.serviceRadius}
                  onChange={(e) =>
                    setFormData({ ...formData, serviceRadius: e.target.value })
                  }
                  className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                >
                  <option value="10">10 km</option>
                  <option value="25">25 km</option>
                  <option value="50">50 km</option>
                  <option value="100">100 km</option>
                </select>
              </div>
            </div>
          </div>

          {/* Profile Photo & Gallery */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Bilder</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Profilbild
                </label>
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary text-2xl font-bold text-white">
                    M
                  </div>
                  <button
                    type="button"
                    className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-background"
                  >
                    Bild ändern
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Galerie / Portfolio
                </label>
                <div className="rounded-lg border-2 border-dashed border-border p-4 text-center">
                  <p className="text-sm text-muted">
                    Bilder hierher ziehen oder klicken
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Link
              href="/dashboard"
              className="rounded-lg border border-border px-6 py-3 font-medium hover:bg-background"
            >
              Abbrechen
            </Link>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-primary px-6 py-3 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {isSaving ? "Wird gespeichert..." : "Änderungen speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
