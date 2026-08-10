import { describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Hero } from "@/components/portfolio/Hero";

describe("Hero", () => {
  it("renders the headline and name", () => {
    const { container } = render(<Hero booted />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Hey There!");
    const name = container.querySelector('[data-text="I\'m Divyansh"]');
    expect(name).not.toBeNull();
    expect(name!.textContent).toContain("I'm");
    expect(name!.textContent).toContain("Divyansh");
  });

  it("renders the profile picture with proper alt text", () => {
    render(<Hero booted />);
    const img = screen.getByRole("img", { name: "Portrait of Divyansh Shakya" });
    expect(img).toHaveAttribute("src", "https://avatars.githubusercontent.com/divyanshakya966");
  });

  it("links to the projects section", () => {
    render(<Hero booted />);
    expect(screen.getByRole("link", { name: /View Work/ })).toHaveAttribute("href", "#projects");
  });

  it("does not type while booting is disabled", () => {
    vi.useFakeTimers();
    try {
      render(<Hero booted={false} />);
      expect(screen.getByText("~/")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("types the first role after boot completes", () => {
    vi.useFakeTimers();
    try {
      render(<Hero booted />);
      act(() => vi.advanceTimersByTime(70));
      expect(screen.getByText(/^C$/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("responds to scroll with parallax transform changes", () => {
    const { container } = render(<Hero booted />);
    const centerpiece = container.querySelector(".will-change-transform") as HTMLElement;
    Object.defineProperty(window, "scrollY", { value: 300, writable: true });
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(centerpiece).toHaveStyle("opacity: 0.5");
    expect(centerpiece).toHaveStyle("transform: translateY(-75px) scale(1.075)");
  });
});
