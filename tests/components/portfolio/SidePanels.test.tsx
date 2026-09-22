import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SocialPanel } from "@/components/portfolio/SocialPanel";
import { RightPanel } from "@/components/portfolio/RightPanel";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("side panels follow settings with safe defaults", () => {
  it("renders profile links with defaults when settings are unreachable", () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<SocialPanel />);
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/divyanshakya966",
    );
    expect(screen.getByRole("link", { name: "X" })).toHaveAttribute(
      "href",
      "https://x.com/divyanshakya966",
    );
    expect(screen.getByRole("link", { name: "TryHackMe" })).toHaveAttribute(
      "href",
      "https://tryhackme.com/p/divyanshakya966",
    );
  });

  it("renders the contact email link with default", () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<RightPanel />);
    expect(screen.getByRole("link", { name: "Email" })).toHaveAttribute(
      "href",
      "mailto:divyanshakya.dev@gmail.com",
    );
    expect(screen.getByRole("link", { name: "Resume" })).toHaveAttribute(
      "href",
      "/resume/Divyansh_Shakya_Resume_Digital.pdf",
    );
  });
});
