"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { providerApi, ProviderProfile } from "@/lib/api";

const categoryKeys = [
  "cleaning",
  "moving",
  "renovation",
  "garden",
  "electrician",
  "plumber",
];

// Map category slugs from API to frontend keys
const categorySlugMap: Record<string, string> = {
  "reinigung": "cleaning",
  "umzug": "moving",
  "renovierung": "renovation",
  "garten": "garden",
  "elektriker": "electrician",
  "klempner": "plumber",
};

export default function ProviderProfilePage() {
  const t = useTranslations("provider.profile");
  const tNav = useTranslations("provider.dashboard.navigation");
  const tCat = useTranslations("categories");

  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    description: "",
    categories: [] as string[],
    postalCode: "",
    city: "",
    serviceRadius: "25",
    priceMin: "",
    priceMax: "",
    experienceYears: "",
    website: "",
  });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("armut_access_token");
        if (token) {
          const profile = await providerApi.getProfile(token);
          
          // Map services to category keys
          const categoryList = profile.services.map(s => 
            categorySlugMap[s.category.slug] || s.category.slug
          );
          
          // Get price range from first service
          const firstService = profile.services[0];
          
          setFormData({
            companyName: profile.companyName || "",
            contactName: `${profile.user.firstName} ${profile.user.lastName}`,
            email: profile.user.email,
            phone: profile.user.phone || "",
            description: profile.description,
            categories: categoryList,
            postalCode: "", // Would need to reverse geocode
            city: "Berlin", // Would need to reverse geocode
            serviceRadius: profile.serviceAreaRadius.toString(),
            priceMin: firstService?.priceMin?.toString() || "",
            priceMax: firstService?.priceMax?.toString() || "",
            experienceYears: profile.experienceYears.toString(),
            website: "",
          });
          setProfileImage(profile.user.profileImage);
        }
      } catch (error) {
        console.error("Failed to fetch profile", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    // TODO: Implement profile update API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
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
              {tNav("overview")}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-6 text-sm text-muted">
          <Link href="/dashboard" className="hover:text-primary">
            {tNav("overview")}
          </Link>
          {" / "}
          <span>{t("title")}</span>
        </nav>

        <h1 className="mb-8 text-2xl font-bold">{t("title")}</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Info */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">{t("companyInfo")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t("companyName")} {t("required")}
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
                  {t("contactName")} {t("required")}
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
                  {t("email")} {t("required")}
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
                  {t("phone")} {t("required")}
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
                {t("description")} {t("required")}
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
                {t("descriptionHint")}
              </p>
            </div>
          </div>

          {/* Services */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">{t("services")}</h2>
            <div>
              <label className="mb-2 block text-sm font-medium">
                {t("categories")} {t("required")}
              </label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {categoryKeys.map((key) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 hover:border-primary"
                  >
                    <input
                      type="checkbox"
                      checked={formData.categories.includes(key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            categories: [...formData.categories, key],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            categories: formData.categories.filter(
                              (c) => c !== key
                            ),
                          });
                        }
                      }}
                      className="rounded border-border"
                    />
                    <span>{tCat(`${key}.name`)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t("experienceYears")}
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
                  {t("priceFrom")}
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
                  {t("priceTo")}
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
            <h2 className="mb-4 text-lg font-semibold">{t("serviceArea")}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t("postalCode")} {t("required")}
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
                <label className="mb-2 block text-sm font-medium">{t("city")} {t("required")}</label>
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
                  {t("serviceRadius")}
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
            <h2 className="mb-4 text-lg font-semibold">{t("images")}</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t("profilePicture")}
                </label>
                <div className="flex items-center gap-4">
                  {profileImage ? (
                    <img 
                      src={profileImage} 
                      alt="Profile" 
                      className="h-20 w-20 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary text-2xl font-bold text-white">
                      {formData.contactName.charAt(0) || "P"}
                    </div>
                  )}
                  <button
                    type="button"
                    className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-background"
                  >
                    {t("changeImage")}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t("gallery")}
                </label>
                <div className="rounded-lg border-2 border-dashed border-border p-4 text-center">
                  <p className="text-sm text-muted">
                    {t("dragImages")}
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
              {t("cancel")}
            </Link>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-primary px-6 py-3 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {isSaving ? t("saving") : t("saveChanges")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
