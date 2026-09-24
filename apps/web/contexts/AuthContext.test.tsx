"use client";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import { ApiError, authApi, type LoginResponse, type User } from "@/lib/api";

const baseUser: User = {
  id: "user-1",
  email: "customer@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  userType: "customer",
  createdAt: new Date().toISOString(),
};

function AuthProbe() {
  const { isAuthenticated, isLoading, logout, refreshAuth, user } = useAuth();

  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="authenticated">{String(isAuthenticated)}</div>
      <div data-testid="email">{user?.email ?? "none"}</div>
      <button type="button" onClick={() => void refreshAuth()}>
        refresh
      </button>
      <button type="button" onClick={() => void logout()}>
        logout
      </button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>,
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("hydrates the auth state from storage and refreshes the current user", async () => {
    localStorage.setItem("armut_access_token", "stored-access");
    localStorage.setItem("armut_refresh_token", "stored-refresh");
    localStorage.setItem("armut_user", JSON.stringify(baseUser));
    vi.spyOn(authApi, "getMe").mockResolvedValue(baseUser);

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("false"),
    );

    expect(authApi.getMe).toHaveBeenCalledWith("stored-access");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    expect(screen.getByTestId("email")).toHaveTextContent(baseUser.email);
  });

  it("falls back to refresh tokens when the access token lookup fails", async () => {
    const refreshedUser = { ...baseUser, email: "fresh@example.com" };
    const refreshPayload: LoginResponse = {
      accessToken: "fresh-access",
      refreshToken: "fresh-refresh",
      user: refreshedUser,
    };

    localStorage.setItem("armut_access_token", "stale-access");
    localStorage.setItem("armut_refresh_token", "refresh-token");
    localStorage.setItem("armut_user", JSON.stringify(baseUser));
    vi.spyOn(authApi, "getMe").mockRejectedValue(new Error("expired"));
    vi.spyOn(authApi, "refreshToken").mockResolvedValue(refreshPayload);

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId("email")).toHaveTextContent("fresh@example.com"),
    );

    expect(authApi.refreshToken).toHaveBeenCalledWith("refresh-token");
    expect(localStorage.getItem("armut_access_token")).toBe("fresh-access");
    expect(localStorage.getItem("armut_refresh_token")).toBe("fresh-refresh");
  });

  it("keeps the session when the session check is rate limited", async () => {
    localStorage.setItem("armut_access_token", "stored-access");
    localStorage.setItem("armut_refresh_token", "stored-refresh");
    localStorage.setItem("armut_user", JSON.stringify(baseUser));
    const rateLimited = new ApiError("Too Many Requests", {
      status: 429,
      code: "http",
    });
    vi.spyOn(authApi, "getMe").mockRejectedValue(rateLimited);
    vi.spyOn(authApi, "refreshToken").mockRejectedValue(rateLimited);

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("false"),
    );

    expect(authApi.refreshToken).not.toHaveBeenCalled();
    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    expect(localStorage.getItem("armut_access_token")).toBe("stored-access");
  });

  it("clears local auth state when logout fails remotely", async () => {
    localStorage.setItem("armut_access_token", "stored-access");
    localStorage.setItem("armut_refresh_token", "stored-refresh");
    localStorage.setItem("armut_user", JSON.stringify(baseUser));
    vi.spyOn(authApi, "getMe").mockResolvedValue(baseUser);
    vi.spyOn(authApi, "logout").mockRejectedValue(new Error("network"));

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true"),
    );

    fireEvent.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() =>
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false"),
    );

    expect(localStorage.getItem("armut_access_token")).toBeNull();
    expect(localStorage.getItem("armut_refresh_token")).toBeNull();
    expect(localStorage.getItem("armut_user")).toBeNull();
  });
});
