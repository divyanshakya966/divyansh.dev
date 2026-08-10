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

  it("renders the tagline", () => {
    render(<Footer />);
    expect(screen.getByText("crafted in")).toBeInTheDocument();
    expect(screen.getByText("vim & vite")).toBeInTheDocument();
  });

  it("is a <footer> element", () => {
    const { container } = render(<Footer />);
    expect(container.querySelector("footer")).not.toBeNull();
  });
});
