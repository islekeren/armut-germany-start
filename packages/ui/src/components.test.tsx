import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button.js";
import { Card } from "./card.js";
import { Code } from "./code.js";

describe("@repo/ui components", () => {
  it("fires the sample alert with the app name", async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    const view = render(<Button appName="web">Launch</Button>);

    await user.click(view.getByRole("button", { name: "Launch" }));

    expect(alertSpy).toHaveBeenCalledWith("Hello from your web app!");
  });

  it("renders tracking links without stray characters", () => {
    const view = render(
      <Card href="https://example.com" title="Docs">
        Read the docs
      </Card>,
    );
    const link = view.getByRole("link", { name: /docs/i });

    expect(link.getAttribute("href")).toBe(
      "https://example.com?utm_source=create-turbo&utm_medium=basic&utm_campaign=create-turbo",
    );
  });

  it("renders inline code content", () => {
    const view = render(<Code className="mono">npm run test</Code>);
    const code = view.getByText("npm run test");

    expect(code.className).toContain("mono");
  });
});
