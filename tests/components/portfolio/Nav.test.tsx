import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Nav } from "@/components/portfolio/Nav";

const LINKS = [
  ["#about", "About"],
  ["#skills", "Skills"],
  ["#projects", "Projects"],
  ["#experience", "Experience"],
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
});
