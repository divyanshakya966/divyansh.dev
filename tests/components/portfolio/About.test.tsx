import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { About } from "@/components/portfolio/About";

describe("About", () => {
  it("renders the section eyebrow and heading", () => {
    render(<About />);
    expect(screen.getByText("01 / About")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Aspiring security engineer building",
    );
  });

  it("renders the four focus cards", () => {
    render(<About />);
    for (const title of ["Security First", "Cloud & DevSecOps", "Builder", "Linux Native"]) {
      expect(screen.getByRole("heading", { level: 3, name: title })).toBeInTheDocument();
    }
  });

  it("renders each card body", () => {
    render(<About />);
    expect(screen.getByText(/Aspiring security engineer — DevSecOps/)).toBeInTheDocument();
    expect(screen.getByText(/Docker, Kubernetes, CI\/CD/)).toBeInTheDocument();
    expect(screen.getByText(/Full-stack apps, Discord/)).toBeInTheDocument();
    expect(screen.getByText(/Lives in the terminal/)).toBeInTheDocument();
  });

  it("description mentions Bhopal college", () => {
    render(<About />);
    expect(screen.getByText(/Oriental College of Technology, Bhopal/)).toBeInTheDocument();
  });
});
