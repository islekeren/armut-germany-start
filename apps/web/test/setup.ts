import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  if (typeof localStorage?.clear === "function") localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
