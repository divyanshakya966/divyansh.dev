import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Experience } from "@/components/portfolio/Experience";

const ITEMS = [
  { title: "Cybersecurity Trainee", when: "August 2026", where: "HackTheBox" },
  { title: "Open Source Contributor", when: "May 2026", where: "GSSoC 2026" },
  { title: "National Hackathon Finalist · 2x", where: "National Level Hackathons" },
  { title: "Security Trainee", when: "Feb 2026", where: "TryHackMe" },
  {
    title: "B.Tech CSE — Cybersecurity",
    where: "Oriental College of Technology, Bhopal",
  },
];

describe("Experience", () => {
  it("renders the section header", () => {
    render(<Experience />);
    expect(screen.getByText("04 / Experience")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Training,");
  });

  it("renders all timeline entries", () => {
    render(<Experience />);
    ITEMS.forEach(({ title, where }) => {
      expect(screen.getByRole("heading", { level: 3, name: title })).toBeInTheDocument();
      expect(screen.getByText(where!)).toBeInTheDocument();
    });
  });

  it("shows period tags for each entry", () => {
    render(<Experience />);
    for (const label of [
      "August 2026 – Present · Cybersecurity",
      "May 2026 – July 2026 · Open Source",
      "Feb 2026 – Present · Cybersecurity",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
