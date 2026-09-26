import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Skills } from "@/components/portfolio/Skills";

const GROUPS = ["Languages", "Web & Backend", "DevSecOps & Cloud", "Security"];
const SAMPLE_SKILLS = [
  "C/C++",
  "Python",
  "AI assisted frontend development",
  "Docker",
  "Kubernetes",
  "TryHackMe",
  "HackTheBox",
];

describe("Skills", () => {
  it("renders the section header", () => {
    render(<Skills />);
    expect(screen.getByText("02 / Skills")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("The toolkit,");
  });

  it("renders all four skill groups as tabs", () => {
    render(<Skills />);
    GROUPS.forEach((g) =>
      expect(
        screen.getByRole("tab", { name: new RegExp(g.replace(/[&]/g, "&")) }),
      ).toBeInTheDocument(),
    );
  });

  it("shows first group skills and switches on tab click", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<Skills />);
    // First group active by default.
    expect(screen.getAllByText("C/C++").length).toBeGreaterThan(0);
    // Switch to Security tab reveals its skills.
    await user.click(screen.getByRole("tab", { name: /Security/ }));
    expect(await screen.findAllByText("TryHackMe")).not.toHaveLength(0);
  });

  it("renders sample skills from every group", () => {
    render(<Skills />);
    SAMPLE_SKILLS.forEach((skill) => expect(screen.getAllByText(skill).length).toBeGreaterThan(0));
  });

  it("renders numbered group badges", () => {
    render(<Skills />);
    for (const n of ["01", "02", "03", "04"]) {
      expect(screen.getAllByText(n).length).toBeGreaterThan(0);
    }
  });
});
