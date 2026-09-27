import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Testimonials } from "@/components/portfolio/Testimonials";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Testimonials", () => {
  it("stays hidden until at least one item is published", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [], source: "empty" }) }),
    );
    const { container } = render(<Testimonials />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("10 / Kind words")).not.toBeInTheDocument();
  });

  it("renders published quotes with attribution", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        if (String(url).includes("/api/content")) {
          return {
            ok: true,
            json: async () => ({
              items: [
                {
                  id: 1,
                  kind: "testimonial",
                  title: "Jane Mentor",
                  subtitle: "Senior Engineer @ Acme",
                  description: "Divyansh ships secure code fast.",
                  url: "",
                  image: "",
                  tags: [],
                  meta: {},
                  sort_order: 1,
                  is_visible: true,
                },
              ],
              source: "db",
            }),
          };
        }
        return { ok: true, json: async () => ({ settings: {} }) };
      }),
    );
    render(<Testimonials />);
    expect(await screen.findByText("10 / Kind words")).toBeInTheDocument();
    expect(screen.getByText("Jane Mentor")).toBeInTheDocument();
    expect(screen.getByText(/ships secure code fast/)).toBeInTheDocument();
  });
});
