import { beforeAll, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Terminal } from "@/components/portfolio/Terminal";
import { CommandPalette } from "@/components/portfolio/CommandPalette";
import { WindowScrim } from "@/components/portfolio/WindowScrim";

describe("WindowScrim", () => {
  beforeAll(() => {
    // jsdom has no Element.scrollTo; the Terminal scrolls itself on open.
    if (typeof Element !== "undefined" && !Element.prototype.scrollTo) {
      Element.prototype.scrollTo = () => {};
    }
  });

  it("stays behind every window: the site stays dimmed while both are open", async () => {
    render(
      <>
        <WindowScrim />
        <CommandPalette />
        <Terminal />
      </>,
    );
    // Nothing open — no scrim.
    expect(screen.queryByTestId("window-scrim")).not.toBeInTheDocument();

    // Open the terminal — scrim appears and dims the site.
    act(() => {
      window.dispatchEvent(new Event("toggle-terminal"));
    });
    let scrim = screen.getByTestId("window-scrim");
    expect(scrim.className).toContain("bg-black/60");
    expect(scrim.className).toContain("backdrop-blur-sm");

    // Open the palette too — the scrim must NOT disappear (site stays dimmed).
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });
    expect(screen.getByRole("dialog", { name: "Terminal" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
    scrim = screen.getByTestId("window-scrim");
    expect(scrim.className).toContain("bg-black/60");

    // Clicking away dismisses only the focused window (the palette).
    act(() => {
      fireEvent.click(scrim);
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
    });
    // The terminal survives, and the scrim keeps the site dimmed.
    expect(screen.getByRole("dialog", { name: "Terminal" })).toBeInTheDocument();
    expect(screen.getByTestId("window-scrim")).toBeInTheDocument();

    // Closing the last window removes the scrim.
    act(() => {
      window.dispatchEvent(new Event("toggle-terminal"));
    });
    await waitFor(() => {
      expect(screen.queryByTestId("window-scrim")).not.toBeInTheDocument();
    });
  });
});
