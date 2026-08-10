import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Projects } from "@/components/portfolio/Projects";

const PROJECT_TITLES = ["AegisStack", "SmartCampus", "Discord AI ChatBot", "Telegram Mod Bot"];

describe("Projects", () => {
  it("renders the section header", () => {
    render(<Projects />);
    expect(screen.getByText("03 / Projects")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Selected");
  });

  it("renders all four project cards", () => {
    render(<Projects />);
    PROJECT_TITLES.forEach((t) =>
      expect(screen.getByRole("heading", { level: 3, name: t })).toBeInTheDocument(),
    );
  });

  it("opens the project detail dialog on click", async () => {
    const user = userEvent.setup();
    render(<Projects />);
    await user.click(screen.getByRole("heading", { name: "AegisStack" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAccessibleName("AegisStack");
    expect(dialog).toHaveTextContent(/AegisStack is a DevSecOps assistant/);
  });

  it("opens the dialog via keyboard (Enter)", async () => {
    const user = userEvent.setup();
    render(<Projects />);
    const card = screen.getByRole("button", { name: "View details about SmartCampus" });
    card.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog")).toHaveAccessibleName("SmartCampus");
  });

  it("project cards expose dialog a11y semantics", () => {
    render(<Projects />);
    const card = screen.getByRole("button", { name: "View details about AegisStack" });
    expect(card).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("respects the GitHub link without opening the dialog", async () => {
    const user = userEvent.setup();
    render(<Projects />);
    const card = screen.getByRole("button", { name: "View details about AegisStack" });
    const gitHubLink = card.querySelector(
      'a[href="https://github.com/divyanshakya966/AegisStack"]',
    );
    expect(gitHubLink).not.toBeNull();
    await user.click(gitHubLink!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the source link inside the dialog", async () => {
    const user = userEvent.setup();
    render(<Projects />);
    await user.click(screen.getByRole("heading", { name: "AegisStack" }));
    const dialog = await screen.findByRole("dialog");
    const source = dialog.querySelector('a[href="https://github.com/divyanshakya966/AegisStack"]');
    expect(source).not.toBeNull();
    expect(source).toHaveAttribute("target", "_blank");
  });
});
