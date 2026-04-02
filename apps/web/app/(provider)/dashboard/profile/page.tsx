"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  FormInput,
  FormLabel,
  FormTextarea,
  PanelCard,
  ProviderRatingStars,
  ProviderSubpageShell,
} from "@/components";
import { useAuth } from "@/contexts";
import {
  providerApi,
  type ProviderOpeningHour,
  type ProviderProfile,
  type ProviderReview,
} from "@/lib/api";

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const EMPTY_FORM_DATA = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  headline: "",
  description: "",
  bio: "",
  highlightsText: "",
  languagesText: "",
  streetAddress: "",
  postalCode: "",
  city: "",
  serviceRadius: "25",
  experienceYears: "0",
  priceMin: "",
  priceMax: "",
  website: "",
};

type FormData = typeof EMPTY_FORM_DATA;

function splitContactName(contactName: string) {
  const trimmed = contactName.trim();
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }

  const [firstName, ...lastNameParts] = trimmed.split(/\s+/);
  return {
    firstName,
    lastName: lastNameParts.join(" "),
  };
}

function toCsv(value: string[] | null | undefined) {
  if (!value || !value.length) return "";
  return value.join(", ");
}

function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeOpeningHours(
  openingHours: ProviderOpeningHour[] | null | undefined,
) {
  const byDay = new Map(
    (openingHours || []).map((item) => [item.day.toLowerCase(), item]),
  );

  return DAY_ORDER.map((day) => {
    const existing = byDay.get(day);
    if (!existing) {
      return { day, closed: false, open: "08:00", close: "18:00" };
    }
    return {
      day,
      closed: !!existing.closed,
      open: existing.open || "08:00",
      close: existing.close || "18:00",
    };
  });
}

function mapProfileToFormData(profile: ProviderProfile): FormData {
  const firstService = profile.services[0];

  return {
    companyName: profile.companyName || "",
    contactName:
      `${profile.user.firstName} ${profile.user.lastName}`.trim() ||
      profile.user.firstName,
    email: profile.user.email,
    phone: profile.user.phone || "",
    headline: profile.profile?.headline || "",
    description: profile.description || "",
    bio: profile.profile?.bio || "",
    highlightsText: toCsv(profile.profile?.highlights),
    languagesText: toCsv(profile.profile?.languages),
    streetAddress: profile.profile?.addressLine1 || "",
    postalCode: profile.profile?.postalCode || "",
    city: profile.profile?.city || "",
    serviceRadius: String(profile.serviceAreaRadius || 25),
    experienceYears: String(profile.experienceYears || 0),
    priceMin: firstService?.priceMin?.toString() || "",
    priceMax: firstService?.priceMax?.toString() || "",
    website: profile.profile?.website || "",
  };
}

export default function ProviderProfilePage() {
  const t = useTranslations("provider.profile");
  const tNav = useTranslations("provider.dashboard.navigation");
  const tPublic = useTranslations("providerPublicProfile");
  const { refreshAuth } = useAuth();

  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [reviews, setReviews] = useState<ProviderReview[]>([]);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM_DATA);
  const [openingHours, setOpeningHours] = useState<ProviderOpeningHour[]>(
    normalizeOpeningHours(null),
  );
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("armut_access_token");
        if (!token) return;

        const [profileData, reviewsData] = await Promise.all([
          providerApi.getProfile(token),
          providerApi.getReviews(token, { page: 1, limit: 5 }),
        ]);

        setProfile(profileData);
        setReviews(reviewsData.data || []);
        setFormData(mapProfileToFormData(profileData));
        setOpeningHours(normalizeOpeningHours(profileData.profile?.openingHours));
      } catch (error) {
        console.error("Failed to fetch provider profile data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const companyDisplayName = useMemo(() => {
    if (formData.companyName.trim()) return formData.companyName.trim();
    return formData.contactName.trim() || "Provider";
  }, [formData.companyName, formData.contactName]);

  const updateOpeningHour = (
    index: number,
    key: "open" | "close" | "closed",
    value: string | boolean,
  ) => {
    setOpeningHours((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (key === "closed") {
          return { ...item, closed: Boolean(value) };
        }
        return { ...item, [key]: String(value) };
      }),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus("idle");

    try {
      const token = localStorage.getItem("armut_access_token");
      if (!token) {
        setSaveStatus("error");
        return;
      }

      const { firstName, lastName } = splitContactName(formData.contactName);
      const payload = {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        companyName: formData.companyName || undefined,
        headline: formData.headline || undefined,
        description: formData.description || undefined,
        bio: formData.bio || undefined,
        experienceYears: Number(formData.experienceYears) || 0,
        serviceAreaRadius: Number(formData.serviceRadius) || 25,
        priceMin: formData.priceMin ? Number(formData.priceMin) : undefined,
        priceMax: formData.priceMax ? Number(formData.priceMax) : undefined,
        addressLine1: formData.streetAddress || undefined,
        city: formData.city || undefined,
        postalCode: formData.postalCode || undefined,
        website: formData.website || undefined,
        highlights: parseCsv(formData.highlightsText),
        languages: parseCsv(formData.languagesText),
        openingHours: openingHours.map((item) => ({
          day: item.day,
          closed: !!item.closed,
          open: item.closed ? null : item.open || null,
          close: item.closed ? null : item.close || null,
        })),
      };

      const updatedProfile = await providerApi.updateProfile(token, payload);
      setProfile(updatedProfile);
      setFormData(mapProfileToFormData(updatedProfile));
      setOpeningHours(normalizeOpeningHours(updatedProfile.profile?.openingHours));

      try {
        await refreshAuth();
      } catch (refreshError) {
        console.error("Failed to refresh auth context", refreshError);
      }

      setSaveStatus("success");
    } catch (error) {
      console.error("Failed to update provider profile", error);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        {t("loading") || "Loading..."}
      </div>
    );
  }

  return (
    <ProviderSubpageShell title={t("title")} backLabel={tNav("overview")}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="relative overflow-hidden rounded-2xl bg-primary px-6 py-8 text-white">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-dark/70 to-primary/60" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-4">
              {profile?.user.profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.user.profileImage}
                  alt={companyDisplayName}
                  className="h-20 w-20 rounded-2xl border border-white/30 object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 text-3xl font-semibold">
                  {companyDisplayName.charAt(0)}
                </div>
              )}

              <div className="min-w-0">
                <FormInput
                  value={formData.companyName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, companyName: e.target.value }))
                  }
                  placeholder={t("companyName")}
                  className="h-auto border-white/30 bg-white/10 px-0 py-0 text-3xl font-bold text-white placeholder:text-white/70 focus:border-white/70 md:text-4xl"
                  accent="primary"
                />
                <FormInput
                  value={formData.headline}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, headline: e.target.value }))
                  }
                  placeholder={tPublic("about")}
                  className="mt-2 border-white/20 bg-white/10 text-white placeholder:text-white/70"
                  accent="primary"
                />
                <div className="mt-3 flex items-center gap-2">
                  <ProviderRatingStars value={profile?.ratingAvg || 0} sizeClassName="text-lg" />
                  <span className="font-semibold">
                    {(profile?.ratingAvg || 0).toFixed(1)}
                  </span>
                  <span className="text-white/80">
                    {tPublic("reviewsCount", { count: profile?.totalReviews || 0 })}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-secondary px-5 py-2.5 font-semibold text-white hover:bg-secondary/90 disabled:opacity-60"
            >
              {isSaving ? t("saving") : t("saveChanges")}
            </button>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <PanelCard>
              <h2 className="text-xl font-semibold">{tPublic("about")}</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <FormLabel>{t("description")}</FormLabel>
                  <FormTextarea
                    rows={4}
                    value={formData.bio}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, bio: e.target.value }))
                    }
                    accent="primary"
                  />
                </div>
                <div>
                  <FormLabel>{tPublic("highlights")}</FormLabel>
                  <FormInput
                    value={formData.highlightsText}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        highlightsText: e.target.value,
                      }))
                    }
                    placeholder="Verified Provider, Fast Response"
                    accent="primary"
                  />
                  <p className="mt-1 text-xs text-muted">Comma separated</p>
                </div>
                <div>
                  <FormLabel>{tPublic("languages")}</FormLabel>
                  <FormInput
                    value={formData.languagesText}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        languagesText: e.target.value,
                      }))
                    }
                    placeholder="German, English"
                    accent="primary"
                  />
                  <p className="mt-1 text-xs text-muted">Comma separated</p>
                </div>
              </div>
            </PanelCard>

            <PanelCard>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">{tPublic("services")}</h2>
                <span className="text-sm text-muted">{profile?.services.length || 0}</span>
              </div>
              <div className="space-y-3">
                {(profile?.services || []).map((service) => (
                  <article key={service.id} className="rounded-lg border border-border p-4">
                    <p className="text-sm text-muted">
                      {service.category.nameEn}
                    </p>
                    <h3 className="font-semibold">{service.title}</h3>
                    <p className="mt-1 text-sm text-muted">{service.description}</p>
                  </article>
                ))}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <FormLabel>{t("experienceYears")}</FormLabel>
                  <FormInput
                    type="number"
                    value={formData.experienceYears}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        experienceYears: e.target.value,
                      }))
                    }
                    accent="primary"
                  />
                </div>
                <div>
                  <FormLabel>{t("priceFrom")}</FormLabel>
                  <FormInput
                    type="number"
                    value={formData.priceMin}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, priceMin: e.target.value }))
                    }
                    accent="primary"
                  />
                </div>
                <div>
                  <FormLabel>{t("priceTo")}</FormLabel>
                  <FormInput
                    type="number"
                    value={formData.priceMax}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, priceMax: e.target.value }))
                    }
                    accent="primary"
                  />
                </div>
              </div>
            </PanelCard>

            <PanelCard>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">{tPublic("reviews")}</h2>
                <span className="text-sm text-muted">
                  {tPublic("reviewsCount", { count: profile?.totalReviews || 0 })}
                </span>
              </div>
              {reviews.length ? (
                <ul className="space-y-3">
                  {reviews.map((review) => (
                    <li key={review.id} className="rounded-lg border border-border p-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-medium">{review.customer}</p>
                        <p className="text-sm text-muted">
                          {new Date(review.date).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {review.comment || tPublic("noComment")}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">{tPublic("noReviews")}</p>
              )}
            </PanelCard>
          </div>

          <div className="space-y-6">
            <PanelCard>
              <h2 className="text-lg font-semibold">{tPublic("contact")}</h2>
              <div className="mt-4 space-y-3">
                <div>
                  <FormLabel>{t("contactName")}</FormLabel>
                  <FormInput
                    value={formData.contactName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, contactName: e.target.value }))
                    }
                    accent="primary"
                  />
                </div>
                <div>
                  <FormLabel>{t("email")}</FormLabel>
                  <FormInput
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, email: e.target.value }))
                    }
                    accent="primary"
                  />
                </div>
                <div>
                  <FormLabel>{t("phone")}</FormLabel>
                  <FormInput
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    accent="primary"
                  />
                </div>
                <div>
                  <FormLabel>{t("companyAddress")}</FormLabel>
                  <FormInput
                    value={formData.streetAddress}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        streetAddress: e.target.value,
                      }))
                    }
                    accent="primary"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <FormLabel>{t("postalCode")}</FormLabel>
                    <FormInput
                      value={formData.postalCode}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          postalCode: e.target.value,
                        }))
                      }
                      accent="primary"
                    />
                  </div>
                  <div>
                    <FormLabel>{t("city")}</FormLabel>
                    <FormInput
                      value={formData.city}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, city: e.target.value }))
                      }
                      accent="primary"
                    />
                  </div>
                </div>
                <div>
                  <FormLabel>{t("serviceRadius")}</FormLabel>
                  <FormInput
                    type="number"
                    value={formData.serviceRadius}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        serviceRadius: e.target.value,
                      }))
                    }
                    accent="primary"
                  />
                </div>
                <div>
                  <FormLabel>{t("website")}</FormLabel>
                  <FormInput
                    type="url"
                    value={formData.website}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, website: e.target.value }))
                    }
                    accent="primary"
                  />
                </div>
              </div>
            </PanelCard>

            <PanelCard>
              <h2 className="mb-4 text-lg font-semibold">{tPublic("businessHours")}</h2>
              <div className="space-y-3 text-sm">
                {openingHours.map((item, index) => (
                  <div key={item.day} className="grid grid-cols-[1fr_auto] items-center gap-3">
                    <div className="font-medium capitalize">{tPublic(`days.${item.day}`)}</div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-xs text-muted">
                        <input
                          type="checkbox"
                          checked={item.closed}
                          onChange={(e) =>
                            updateOpeningHour(index, "closed", e.target.checked)
                          }
                        />
                        {tPublic("closed")}
                      </label>
                      <input
                        type="time"
                        value={item.open || "08:00"}
                        disabled={item.closed}
                        onChange={(e) => updateOpeningHour(index, "open", e.target.value)}
                        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                      />
                      <span className="text-muted">-</span>
                      <input
                        type="time"
                        value={item.close || "18:00"}
                        disabled={item.closed}
                        onChange={(e) => updateOpeningHour(index, "close", e.target.value)}
                        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </PanelCard>

            <PanelCard>
              <h2 className="text-lg font-semibold">{tPublic("quickFacts")}</h2>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex items-center justify-between gap-3">
                  <span className="text-muted">{tPublic("experience")}</span>
                  <span className="font-medium">
                    {formData.experienceYears} {tPublic("years", { count: Number(formData.experienceYears) || 0 })}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-muted">{tPublic("completedJobs")}</span>
                  <span className="font-medium">-</span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-muted">{tPublic("acceptanceRate")}</span>
                  <span className="font-medium">-</span>
                </li>
              </ul>
            </PanelCard>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          {saveStatus === "success" ? (
            <p className="self-center text-sm text-success">Profile updated successfully.</p>
          ) : null}
          {saveStatus === "error" ? (
            <p className="self-center text-sm text-error">Failed to update profile.</p>
          ) : null}
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
    </ProviderSubpageShell>
  );
}
