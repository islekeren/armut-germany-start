import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import de from "@/messages/de.json";
import { authApi, ApiError } from "@/lib/api";
import { RecoveryForm } from "./RecoveryForm";

vi.mock("@/components/SimpleHeader", () => ({ SimpleHeader: () => null }));
function show(mode: "request" | "reset", locale: "de" | "en" = "en") {
  const messages = locale === "en" ? en : de;
  render(<NextIntlClientProvider locale={locale} messages={messages}><RecoveryForm mode={mode} /></NextIntlClientProvider>);
  return messages.auth.recovery;
}
const validToken = "a".repeat(43);

describe.each(["de", "en"] as const)("RecoveryForm %s", locale => {
  it("requests a reset and shows generic success", async () => {
    const send = vi.spyOn(authApi, "forgotPassword").mockResolvedValue({ message: "generic" });
    const copy = show("request", locale);
    fireEvent.change(screen.getByLabelText(copy.email), { target: { value: "someone@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: copy.requestSubmit }));
    await screen.findByText(copy.requestSuccess);
    expect(send).toHaveBeenCalledWith("someone@example.com", locale);
  });

  it("consumes the fragment and resets with matching passwords", async () => {
    window.history.replaceState(null, "", `/reset-password#token=${validToken}&locale=${locale}`);
    const send = vi.spyOn(authApi, "resetPassword").mockResolvedValue({ message: "ok" });
    const copy = show("reset", locale);
    await waitFor(() => expect(screen.getByLabelText(copy.password)).toBeEnabled());
    expect(window.location.hash).toBe("");
    fireEvent.change(screen.getByLabelText(copy.password), { target: { value: "NewPassword123!" } });
    fireEvent.change(screen.getByLabelText(copy.confirm), { target: { value: "NewPassword123!" } });
    fireEvent.click(screen.getByRole("button", { name: copy.resetSubmit }));
    await screen.findByText(copy.resetSuccess);
    expect(send).toHaveBeenCalledWith(validToken, "NewPassword123!");
  });

  it("rejects mismatched passwords without calling the API", async () => {
    window.history.replaceState(null, "", `/reset-password#token=${validToken}`);
    const send = vi.spyOn(authApi, "resetPassword").mockResolvedValue({ message: "ok" });
    const copy = show("reset", locale);
    await waitFor(() => expect(screen.getByLabelText(copy.password)).toBeEnabled());
    fireEvent.change(screen.getByLabelText(copy.password), { target: { value: "NewPassword123!" } });
    fireEvent.change(screen.getByLabelText(copy.confirm), { target: { value: "DifferentPassword!" } });
    fireEvent.click(screen.getByRole("button", { name: copy.resetSubmit }));
    expect(await screen.findByText(copy.mismatch)).toBeVisible();
    expect(send).not.toHaveBeenCalled();
  });

  it("shows an invalid link state without a token", async () => {
    window.history.replaceState(null, "", "/reset-password");
    const copy = show("reset", locale);
    await screen.findByText(copy.invalidLink);
    expect(screen.queryByRole("button", { name: copy.resetSubmit })).not.toBeInTheDocument();
  });

  it("shows an expired or reused link state returned by the API", async () => {
    window.history.replaceState(null, "", `/reset-password#token=${validToken}`);
    vi.spyOn(authApi, "resetPassword").mockRejectedValue(new ApiError("Invalid or expired reset link", { status: 400, code: "http" }));
    const copy = show("reset", locale);
    await waitFor(() => expect(screen.getByLabelText(copy.password)).toBeEnabled());
    fireEvent.change(screen.getByLabelText(copy.password), { target: { value: "NewPassword123!" } });
    fireEvent.change(screen.getByLabelText(copy.confirm), { target: { value: "NewPassword123!" } });
    fireEvent.click(screen.getByRole("button", { name: copy.resetSubmit }));
    await screen.findByText(copy.invalidLink);
  });

  it("keeps the form available after a network failure", async () => {
    vi.spyOn(authApi, "forgotPassword").mockRejectedValue(new Error("network"));
    const copy = show("request", locale);
    fireEvent.change(screen.getByLabelText(copy.email), { target: { value: "someone@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: copy.requestSubmit }));
    await screen.findByText(copy.error);
    expect(screen.getByRole("button", { name: copy.requestSubmit })).toBeEnabled();
  });
});
