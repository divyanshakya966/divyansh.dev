import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "@/components/portfolio/Footer";

describe("Footer", () => {
  it("renders the current copyright year", () => {
    vi.setSystemTime(new Date("2026-08-10"));
    render(<Footer />);
    expect(screen.getByText(/© 2026 Divyansh Shakya/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("renders the GitHub CTA", () => {
    render(<Footer />);
    expect(screen.getByText(/Crafting open-source software/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/divyanshakya966/divyansh.dev",
    );
  });

  it("is a <footer> element", () => {
    const { container } = render(<Footer />);
    expect(container.querySelector("footer")).not.toBeNull();
  });
});
