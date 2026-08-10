import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Skills } from "@/components/portfolio/Skills";

const GROUPS = ["Languages", "Web & Backend", "DevSecOps & Cloud", "Security"];
const SAMPLE_SKILLS = [
  "JavaScript",
  "TypeScript",
  "Python",
  "React",
  "Docker",
  "Kubernetes",
  "TryHackMe",
];

describe("Skills", () => {
  it("renders the section header", () => {
    render(<Skills />);
    expect(screen.getByText("02 / Skills")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("The toolkit,");
  });

  it("renders all four skill groups", () => {
    render(<Skills />);
    GROUPS.forEach((g) =>
      expect(screen.getByRole("heading", { level: 3, name: g })).toBeInTheDocument(),
    );
  });

  it("renders sample skills from every group", () => {
    render(<Skills />);
    SAMPLE_SKILLS.forEach((skill) => expect(screen.getByText(skill)).toBeInTheDocument());
  });

  it("renders numbered group badges", () => {
    render(<Skills />);
    for (const n of ["01", "02", "03", "04"]) {
      expect(screen.getAllByText(n).length).toBeGreaterThan(0);
    }
  });
});
