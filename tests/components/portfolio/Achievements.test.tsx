import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Achievements } from "@/components/portfolio/Achievements";

const ITEMS = [
  { title: "Top 1% — TryHackMe", sub: "Global ranking · ongoing" },
  { title: "2x National Hackathon Finalist", sub: "National level · 2025 / 2026" },
  { title: "GSSoC 2026 Contributor", sub: "Open source · 2026" },
  { title: "Active Open Source Dev", sub: "GitHub @divyanshakya966" },
];

describe("Achievements", () => {
  it("renders the section header", () => {
    render(<Achievements />);
    expect(screen.getByText("05 / Achievements")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Highlights &");
  });

  it("renders all achievement cards with subtitles", () => {
    render(<Achievements />);
    ITEMS.forEach(({ title, sub }) => {
      expect(screen.getByText(title)).toBeInTheDocument();
      expect(screen.getByText(sub)).toBeInTheDocument();
    });
  });
});
