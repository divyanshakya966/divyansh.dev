import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Cursor } from "@/components/portfolio/Cursor";
import { setMatchMedia } from "../../setup";

describe("Cursor", () => {
  it("renders nothing on coarse-pointer devices", () => {
    setMatchMedia({ "(pointer: fine)": false });
    render(<Cursor />);
    expect(screen.queryByLabelText("custom cursor")).not.toBeInTheDocument();
    expect(document.documentElement.classList.contains("custom-cursor")).toBe(false);
  });

  it("renders the cursor and adds the CSS class on fine pointers", () => {
    setMatchMedia({ "(pointer: fine)": true });
    render(<Cursor />);
    expect(document.documentElement.classList.contains("custom-cursor")).toBe(true);
    expect(document.querySelector(".portfolio-cursor-pointer")).not.toBeNull();
  });

  it("follows the mouse position", () => {
    setMatchMedia({ "(pointer: fine)": true });
    render(<Cursor />);
    const pointer = document.querySelector<HTMLElement>(".portfolio-cursor-pointer")!;
    fireEvent.mouseMove(window, { clientX: 120, clientY: 80 });
    expect(pointer.style.transform).toBe("translate3d(115px, 77px, 0)");
  });

  it("removes the CSS class on unmount", () => {
    setMatchMedia({ "(pointer: fine)": true });
    const { unmount } = render(<Cursor />);
    expect(document.documentElement.classList.contains("custom-cursor")).toBe(true);
    unmount();
    expect(document.documentElement.classList.contains("custom-cursor")).toBe(false);
  });
});
