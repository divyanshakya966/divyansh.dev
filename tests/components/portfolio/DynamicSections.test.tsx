import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Certifications } from "@/components/portfolio/Certifications";
import { Research } from "@/components/portfolio/Research";
import { Blogs } from "@/components/portfolio/Blogs";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Certifications", () => {
  it("renders seeded certs immediately (no fetch needed)", () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<Certifications />);
    expect(screen.getByText("05 / Certifications")).toBeInTheDocument();
    expect(screen.getByText("Cyber Security 101 (SEC1)")).toBeInTheDocument();
    expect(screen.getByText(/LFS16: Intro to DevOps/)).toBeInTheDocument();
    const verifies = screen.getAllByLabelText(/Verify /);
    expect(verifies).toHaveLength(2);
    expect(verifies[0]).toHaveAttribute("href", expect.stringContaining("tryhackme.com"));
  });
});

describe("Research", () => {
  it("stays hidden when no items exist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) }),
    );
    const { container } = render(<Research />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("appears once an item is published", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 1,
              kind: "research",
              title: "Test Paper",
              subtitle: "Venue 2026",
              description: "Abstract",
              url: "https://example.com",
              image: "",
              tags: ["Security"],
              sort_order: 1,
              is_visible: true,
            },
          ],
        }),
      }),
    );
    render(<Research />);
    expect(await screen.findByText("Test Paper")).toBeInTheDocument();
    expect(screen.getByText("08 / Research")).toBeInTheDocument();
  });
});

describe("Blogs", () => {
  it("stays hidden when no items exist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) }),
    );
    const { container } = render(<Blogs />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("appears once a post is published", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 2,
              kind: "blog",
              title: "Hello Post",
              subtitle: "Notes",
              description: "Body",
              url: "",
              image: "",
              tags: [],
              sort_order: 1,
              is_visible: true,
            },
          ],
        }),
      }),
    );
    render(<Blogs />);
    expect(await screen.findByText("Hello Post")).toBeInTheDocument();
  });
});
