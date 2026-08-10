import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Section } from "@/components/portfolio/Section";

function renderSection(props: {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
}) {
  return render(<Section {...props}>{null}</Section>);
}

describe("Section", () => {
  it("renders id, eyebrow, title and children", () => {
    render(
      <Section id="about" eyebrow="01 / About" title="About me">
        <p>Child content</p>
      </Section>,
    );
    expect(document.getElementById("about")).not.toBeNull();
    expect(screen.getByText("01 / About")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("About me");
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    renderSection({ id: "s", eyebrow: "E", title: "T", description: "A description" });
    expect(screen.getByText("A description")).toBeInTheDocument();
  });

  it("omits the description when not provided", () => {
    renderSection({ id: "s", eyebrow: "E", title: "T" });
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
  });

  it("supports ReactNode titles", () => {
    renderSection({
      id: "s",
      eyebrow: "E",
      title: (
        <>
          Build <span>secure</span> systems
        </>
      ),
    });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Build secure systems");
  });

  it("marks the section with scroll-margin for anchor navigation", () => {
    const { container } = renderSection({ id: "s", eyebrow: "E", title: "T" });
    expect(container.querySelector("section")).toHaveClass("scroll-mt-24");
  });

  it("applies reveal classes to the header elements", () => {
    const { container } = renderSection({
      id: "s",
      eyebrow: "E",
      title: "T",
      description: "D",
    });
    expect(container.querySelectorAll(".reveal-stagger").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".reveal").length).toBeGreaterThan(0);
  });
});
