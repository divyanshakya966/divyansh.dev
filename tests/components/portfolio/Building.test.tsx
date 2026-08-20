import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Building } from "@/components/portfolio/Building";

describe("Building", () => {
  it("renders the section header", () => {
    render(<Building />);
    expect(screen.getByText("06 / Status")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Currently");
  });

  it("renders the three status cards", () => {
    render(<Building />);
    for (const title of ["Building", "Learning", "Right now"]) {
      expect(screen.getByRole("heading", { level: 3, name: title })).toBeInTheDocument();
    }
  });

  it("mentions AegisStack in the building card", () => {
    render(<Building />);
    expect(screen.getByText(/AegisStack — a DevSecOps assistant/)).toBeInTheDocument();
  });

  it("lists the learning topics", () => {
    render(<Building />);
    expect(screen.getByText(/DevSecOps & pipeline security/)).toBeInTheDocument();
    expect(screen.getByText(/Kubernetes & container hardening/)).toBeInTheDocument();
    expect(screen.getByText(/AI & cloud security fundamentals/)).toBeInTheDocument();
  });

  it("shows current stats", () => {
    render(<Building />);
    for (const stat of ["TryHackMe rank", "Open Source", "Hackathon finals"]) {
      expect(screen.getByText(stat)).toBeInTheDocument();
    }
    expect(screen.getByText("Top 1%")).toBeInTheDocument();
    expect(screen.getByText("2x")).toBeInTheDocument();
  });
});
