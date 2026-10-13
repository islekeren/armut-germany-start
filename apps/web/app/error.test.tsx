import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import english from "@/messages/en.json";
import german from "@/messages/de.json";
import ErrorBoundary from "./error";

describe("route error boundary", () => {
  let now = Date.now();
  beforeEach(() => {
    now += 10_001;
    vi.spyOn(Date, "now").mockReturnValue(now);
  });
  it.each(["en", "de"])("shows a generic localized retry in %s and reports no raw error", (locale) => {
    const reports: unknown[] = [];
    vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
      reports.push(JSON.parse(options.body as string));
      return new Response(null, { status: 204 });
    });
    const reset = vi.fn();
    const messages = locale === "de" ? german : english;
    render(<NextIntlClientProvider locale={locale} messages={messages}>
      <ErrorBoundary error={new Error("private token and customer@example.com")} reset={reset} />
    </NextIntlClientProvider>);
    expect(screen.queryByText(/customer@example.com/)).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(messages.providerOnboarding.errors.generic);
    fireEvent.click(screen.getByRole("button", { name: messages.providerOnboarding.buttons.retry }));
    expect(reset).toHaveBeenCalledOnce();
    expect(reports).toEqual([{ operation: "unknown", code: "render" }]);
  });
});
