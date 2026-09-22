import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, within, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Nav } from "@/components/portfolio/Nav";

afterEach(() => {
  vi.unstubAllGlobals();
});

const LINKS = [
  ["#about", "About"],
  ["#skills", "Skills"],
  ["#projects", "Projects"],
  ["#experience", "Experience"],
  ["#certifications", "Certifications"],
  ["#achievements", "Achievements"],
  ["#building", "Building"],
  ["#contact", "Contact"],
] as const;

describe("Nav", () => {
  it("renders desktop links with correct hrefs", () => {
    render(<Nav />);
    LINKS.forEach(([href, label]) => {
      const link = screen.getByRole("link", { name: label });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", href);
    });
  });

  it("renders the terminal prompt mark instead of social links", () => {
    render(<Nav />);
    expect(screen.queryByRole("link", { name: "GitHub" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "LinkedIn" })).not.toBeInTheDocument();
    expect(screen.getByText(">")).toBeInTheDocument();
  });

  it("renders the mobile menu button with aria attributes", () => {
    render(<Nav />);
    const btn = screen.getByRole("button", { name: "Menu" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(btn).toHaveAttribute("aria-controls", "mobile-menu");
  });

  it("opens and closes the mobile menu", async () => {
    const user = userEvent.setup();
    render(<Nav />);
    const btn = screen.getByRole("button", { name: "Menu" });
    await user.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    const menu = within(document.getElementById("mobile-menu")!);
    expect(menu.getByText("About")).toBeInTheDocument();
    await user.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the mobile menu with the Escape key", async () => {
    const user = userEvent.setup();
    render(<Nav />);
    const btn = screen.getByRole("button", { name: "Menu" });
    await user.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the mobile menu after clicking a link inside it", async () => {
    const user = userEvent.setup();
    render(<Nav />);
    const btn = screen.getByRole("button", { name: "Menu" });
    await user.click(btn);
    const menu = within(document.getElementById("mobile-menu")!);
    await user.click(menu.getByRole("link", { name: "Projects" }));
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("scroll-spies sections mounted after initial render (late content)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        if (String(url).includes("/api/settings")) {
          return { ok: true, json: async () => ({ settings: {} }) };
        }
        return { ok: true, json: async () => ({ items: [{ id: 1 }] }) };
      }),
    );
    render(<Nav />);
    // Research link appears once the content API reports published items.
    const research = await screen.findByRole("link", { name: "Research" });
    // The section itself mounts later (content fetch) — spy must pick it up.
    await act(async () => {
      const s = document.createElement("section");
      s.id = "research";
      document.body.appendChild(s);
    });
    const io = window.__ioInstances.at(-1)!;
    const section = document.getElementById("research")!;
    act(() => io.intersect(section));
    await waitFor(() => {
      expect(research.querySelector("span.absolute")).not.toBeNull();
    });
  });

  it("hides links for sections turned off in settings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        if (String(url).includes("/api/settings")) {
          return {
            ok: true,
            json: async () => ({ settings: { section_building_visible: "0" } }),
          };
        }
        return { ok: true, json: async () => ({ items: [] }) };
      }),
    );
    render(<Nav />);
    await waitFor(() => {
      expect(screen.queryByRole("link", { name: "Building" })).toBeNull();
    });
    expect(screen.getByRole("link", { name: "Projects" })).toBeInTheDocument();
  });

  it("survives observer globals going missing (late effect runs)", () => {
    // Fetch never settles; the effect must skip observer construction
    // instead of throwing on the bare constructor.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    vi.stubGlobal("IntersectionObserver", undefined as never);
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Projects" })).toBeInTheDocument();
  });
});
