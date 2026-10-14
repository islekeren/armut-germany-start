import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import english from "@/messages/en.json";
import german from "@/messages/de.json";
import { getCategories, serviceApi } from "@/lib/api";
import ServicesPage from "./page";

vi.mock("@/lib/api", () => ({
  getCategories: vi.fn(),
  serviceApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock("@/components/provider/ProviderSubpageShell", () => ({
  ProviderSubpageShell: ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));

const category = {
  id: "category-1",
  slug: "home-cleaning",
  nameEn: "Home cleaning",
  nameDe: "Wohnungsreinigung",
  icon: "home",
};
const owned = {
  providerId: "provider-1",
  images: [],
  id: "service-1",
  categoryId: category.id,
  category,
  title: "My cleaning",
  description: "Reliable cleaning",
  priceType: "hourly" as const,
  priceMin: 20,
  priceMax: 50,
  isActive: true,
};
function renderPage(locale = "en") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "de" ? german : english}
    >
      <ServicesPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem("machma_access_token", "token");
  vi.mocked(getCategories).mockResolvedValue([category]);
  vi.mocked(serviceApi.list).mockResolvedValue([owned]);
});

describe("service management screen", () => {
  it("lists services and lets the provider deactivate one", async () => {
    vi.mocked(serviceApi.update).mockResolvedValue({
      ...owned,
      isActive: false,
    });
    renderPage();
    expect(
      await screen.findByRole("heading", { name: owned.title }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    await waitFor(() =>
      expect(serviceApi.update).toHaveBeenCalledWith("token", owned.id, {
        isActive: false,
      }),
    );
    expect(
      await screen.findByRole("button", { name: "Activate" }),
    ).toBeVisible();
  });

  it("creates a service and clears empty prices explicitly", async () => {
    vi.mocked(serviceApi.create).mockResolvedValue({
      ...owned,
      id: "new",
      title: "Office cleaning",
      priceMin: null,
      priceMax: null,
    });
    renderPage();
    await screen.findByRole("heading", { name: owned.title });
    fireEvent.click(screen.getByRole("button", { name: "Add Service" }));
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: category.id },
    });
    fireEvent.change(screen.getByLabelText("Service title"), {
      target: { value: "Office cleaning" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "We clean offices" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Service" }));
    await waitFor(() =>
      expect(serviceApi.create).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({
          title: "Office cleaning",
          categoryId: category.id,
          priceMin: null,
          priceMax: null,
        }),
      ),
    );
    expect(
      await screen.findByRole("heading", { name: "Office cleaning" }),
    ).toBeVisible();
  });

  it("keeps the edit form and previous list when saving fails", async () => {
    vi.mocked(serviceApi.update).mockRejectedValue(new Error("failed"));
    renderPage();
    await screen.findByRole("heading", { name: owned.title });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Service title"), {
      target: { value: "Changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Service" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not save the service",
    );
    expect(screen.getByLabelText("Service title")).toHaveValue("Changed");
    expect(screen.getByRole("heading", { name: owned.title })).toBeVisible();
  });

  it("confirms deletion before removing a service", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(serviceApi.remove).mockResolvedValue(owned);
    renderPage();
    await screen.findByRole("heading", { name: owned.title });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: owned.title }),
      ).not.toBeInTheDocument(),
    );
    expect(serviceApi.remove).toHaveBeenCalledWith("token", owned.id);
  });

  it("retries a failed initial load", async () => {
    vi.mocked(serviceApi.list).mockRejectedValueOnce(new Error("offline"));
    renderPage();
    expect(await screen.findByRole("alert")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("heading", { name: owned.title }),
    ).toBeVisible();
  });

  it("renders German category labels", async () => {
    renderPage("de");
    expect(await screen.findByText(category.nameDe)).toBeVisible();
  });
});
