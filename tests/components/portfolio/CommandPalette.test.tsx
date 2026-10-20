import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CommandPalette } from "@/components/portfolio/CommandPalette";

function toggleOpen() {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  });
}

describe("CommandPalette window", () => {
  it("floats on a click-through overlay — the site scrim is a shared layer", () => {
    render(<CommandPalette />);
    toggleOpen();
    const overlay = screen.getByRole("dialog", { name: "Command palette" })
      .parentElement as HTMLElement;
    expect(overlay.className).toContain("pointer-events-none");
    // The window itself must never dim/blur the page.
    expect(overlay.className).not.toContain("bg-black/60");
  });

  it("closes via the title bar close button", async () => {
    render(<CommandPalette />);
    toggleOpen();
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Close command palette" }));
    });
    // The dialog lingers briefly while its exit animation plays.
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
    });
  });

  it("does not close when a click happens inside the window", () => {
    render(<CommandPalette />);
    toggleOpen();
    const dialog = screen.getByRole("dialog", { name: "Command palette" });
    act(() => {
      fireEvent.click(dialog.querySelector("span")!);
    });
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
  });
});
