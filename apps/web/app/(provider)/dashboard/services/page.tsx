"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ProviderSubpageShell } from "@/components/provider/ProviderSubpageShell";
import { PanelCard } from "@/components/ui/PanelCard";
import {
  getCategories,
  serviceApi,
  type Category,
  type ManagedProviderService,
  type ServiceData,
} from "@/lib/api";

type ServiceForm = {
  id?: string;
  categoryId: string;
  title: string;
  description: string;
  priceType: ServiceData["priceType"];
  priceMin: string;
  priceMax: string;
  isActive: boolean;
};
const emptyForm = (): ServiceForm => ({
  categoryId: "",
  title: "",
  description: "",
  priceType: "quote",
  priceMin: "",
  priceMax: "",
  isActive: true,
});
const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 focus:outline-primary";
const buttonClass =
  "rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-background disabled:opacity-50";

export default function ProviderServicesPage() {
  const t = useTranslations("provider.services");
  const tNav = useTranslations("provider.dashboard.navigation");
  const locale = useLocale();
  const [services, setServices] = useState<ManagedProviderService[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [form, setForm] = useState<ServiceForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const token = localStorage.getItem("armut_access_token");
      if (!token) throw new Error("Session required");
      const [owned, available] = await Promise.all([
        serviceApi.list(token),
        getCategories(),
      ]);
      setServices(owned);
      setCategories(available);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startEditing(service?: ManagedProviderService) {
    setError(null);
    setNotice(null);
    setForm(
      service
        ? {
            id: service.id,
            categoryId: service.categoryId,
            title: service.title,
            description: service.description,
            priceType: service.priceType,
            priceMin: service.priceMin == null ? "" : String(service.priceMin),
            priceMax: service.priceMax == null ? "" : String(service.priceMax),
            isActive: service.isActive,
          }
        : emptyForm(),
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || busy) return;
    const priceMin = form.priceMin === "" ? null : Number(form.priceMin);
    const priceMax = form.priceMax === "" ? null : Number(form.priceMax);
    if (priceMin !== null && priceMax !== null && priceMin > priceMax) {
      setError("priceRangeError");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const token = localStorage.getItem("armut_access_token");
      if (!token) throw new Error("Session required");
      const data: ServiceData = {
        categoryId: form.categoryId,
        title: form.title.trim(),
        description: form.description.trim(),
        priceType: form.priceType,
        priceMin,
        priceMax,
        isActive: form.isActive,
      };
      const saved = form.id
        ? await serviceApi.update(token, form.id, data)
        : await serviceApi.create(token, data);
      setServices((current) =>
        form.id
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current],
      );
      setForm(null);
      setNotice("saved");
    } catch {
      setError("saveError");
    } finally {
      setBusy(false);
    }
  }

  async function mutate(service: ManagedProviderService, remove = false) {
    if (busy || (remove && !window.confirm(t("confirmDelete")))) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const token = localStorage.getItem("armut_access_token");
      if (!token) throw new Error("Session required");
      if (remove) {
        await serviceApi.remove(token, service.id);
        setServices((current) =>
          current.filter((item) => item.id !== service.id),
        );
        setNotice("deleted");
      } else {
        const saved = await serviceApi.update(token, service.id, {
          isActive: !service.isActive,
        });
        setServices((current) =>
          current.map((item) => (item.id === saved.id ? saved : item)),
        );
        setNotice("saved");
      }
    } catch {
      setError(remove ? "deleteError" : "saveError");
    } finally {
      setBusy(false);
    }
  }

  const categoryAvailable =
    !!form && categories.some((category) => category.id === form.categoryId);
  const money = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
    }).format(value);

  return (
    <ProviderSubpageShell title={t("title")} backLabel={tNav("overview")}>
      <div className="space-y-6">
        <p className="text-sm text-muted">{t("intro")}</p>
        {loading ? (
          <p role="status">{t("loading")}</p>
        ) : loadFailed ? (
          <PanelCard>
            <p role="alert" className="mb-3 text-error">
              {t("loadError")}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className={buttonClass}
            >
              {t("retry")}
            </button>
          </PanelCard>
        ) : (
          <>
            {error ? (
              <p role="alert" className="text-error">
                {t(error)}
              </p>
            ) : null}
            {notice ? (
              <p role="status" className="text-success">
                {t(notice)}
              </p>
            ) : null}
            {!form ? (
              <button
                type="button"
                disabled={busy || !categories.length}
                onClick={() => startEditing()}
                className="rounded-lg bg-primary px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                {t("add")}
              </button>
            ) : null}
            {!categories.length ? (
              <p role="status" className="text-muted">
                {t("noCategories")}
              </p>
            ) : null}
            {form ? (
              <PanelCard>
                <h2 className="mb-4 text-lg font-semibold">
                  {t(form.id ? "editTitle" : "newTitle")}
                </h2>
                <form onSubmit={save} className="space-y-4">
                  <fieldset
                    disabled={busy}
                    className="space-y-4 disabled:opacity-60"
                  >
                    <div>
                      <label
                        htmlFor="service-category"
                        className="block text-sm font-medium"
                      >
                        {t("category")}
                      </label>
                      <select
                        id="service-category"
                        required
                        value={form.categoryId}
                        onChange={(e) =>
                          setForm({ ...form, categoryId: e.target.value })
                        }
                        className={inputClass}
                      >
                        <option value="">{t("selectCategory")}</option>
                        {!categoryAvailable && form.categoryId ? (
                          <option value={form.categoryId} disabled>
                            {t("retiredCategory")}
                          </option>
                        ) : null}
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {locale === "de"
                              ? category.nameDe
                              : category.nameEn}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="block text-sm font-medium">
                      {t("serviceTitle")}
                      <input
                        required
                        maxLength={200}
                        value={form.title}
                        onChange={(e) =>
                          setForm({ ...form, title: e.target.value })
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      {t("description")}
                      <textarea
                        required
                        maxLength={5000}
                        rows={4}
                        value={form.description}
                        onChange={(e) =>
                          setForm({ ...form, description: e.target.value })
                        }
                        className={inputClass}
                      />
                    </label>
                    <div>
                      <label
                        htmlFor="service-price-type"
                        className="block text-sm font-medium"
                      >
                        {t("priceType")}
                      </label>
                      <select
                        id="service-price-type"
                        value={form.priceType}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            priceType: e.target
                              .value as ServiceData["priceType"],
                          })
                        }
                        className={inputClass}
                      >
                        {(["quote", "fixed", "hourly"] as const).map((type) => (
                          <option key={type} value={type}>
                            {t(type)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-medium">
                        {t("priceMin")}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.priceMin}
                          onChange={(e) =>
                            setForm({ ...form, priceMin: e.target.value })
                          }
                          className={inputClass}
                        />
                      </label>
                      <label className="block text-sm font-medium">
                        {t("priceMax")}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.priceMax}
                          onChange={(e) =>
                            setForm({ ...form, priceMax: e.target.value })
                          }
                          className={inputClass}
                        />
                      </label>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(e) =>
                          setForm({ ...form, isActive: e.target.checked })
                        }
                      />
                      {t("active")}
                    </label>
                    <p className="text-xs text-muted">{t("visibility")}</p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="submit"
                        disabled={
                          !categoryAvailable ||
                          !form.title.trim() ||
                          !form.description.trim()
                        }
                        className="rounded-lg bg-primary px-4 py-2 font-semibold text-white disabled:opacity-50"
                      >
                        {t(busy ? "saving" : "save")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setForm(null);
                          setError(null);
                        }}
                        className={buttonClass}
                      >
                        {t("cancel")}
                      </button>
                    </div>
                  </fieldset>
                </form>
              </PanelCard>
            ) : null}
            {services.length === 0 ? (
              <PanelCard>
                <p className="text-muted">{t("empty")}</p>
              </PanelCard>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {services.map((service) => (
                  <PanelCard key={service.id}>
                    <article className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-muted">
                            {locale === "de"
                              ? service.category.nameDe
                              : service.category.nameEn}
                          </p>
                          <h2 className="text-lg font-semibold">
                            {service.title}
                          </h2>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${service.isActive ? "bg-success/10 text-success" : "bg-background text-muted"}`}
                        >
                          {t(service.isActive ? "active" : "inactive")}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm text-muted">
                        {service.description}
                      </p>
                      <p className="text-sm font-medium">
                        {t(service.priceType)}
                        {service.priceType !== "quote" &&
                        (service.priceMin !== null || service.priceMax !== null)
                          ? ` · ${service.priceMin !== null ? money(service.priceMin) : "—"} – ${service.priceMax !== null ? money(service.priceMax) : "—"}`
                          : ""}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy || !!form}
                          onClick={() => startEditing(service)}
                          className={buttonClass}
                        >
                          {t("edit")}
                        </button>
                        <button
                          type="button"
                          disabled={busy || !!form}
                          onClick={() => void mutate(service)}
                          className={buttonClass}
                        >
                          {t(service.isActive ? "deactivate" : "activate")}
                        </button>
                        <button
                          type="button"
                          disabled={busy || !!form}
                          onClick={() => void mutate(service, true)}
                          className={`${buttonClass} text-error`}
                        >
                          {t("delete")}
                        </button>
                      </div>
                    </article>
                  </PanelCard>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </ProviderSubpageShell>
  );
}
