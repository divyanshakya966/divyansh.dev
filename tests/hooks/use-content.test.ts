import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePublicContent } from "@/hooks/use-content";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubItems(payload: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));
}

describe("usePublicContent empty-answer guard", () => {
  it("keeps seeds when an ambiguous empty answer arrives (no source)", async () => {
    stubItems({ items: [] });
    const { result } = renderHook(() => usePublicContent("certification"));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await waitFor(() =>
      expect(result.current.items.map((i) => i.title)).toContain("Cyber Security 101 (SEC1)"),
    );
    expect(result.current.items.length).toBeGreaterThan(0);
  });

  it("honors a deliberate hide (db-sourced empty)", async () => {
    stubItems({ items: [], source: "db" });
    const { result } = renderHook(() => usePublicContent("certification"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
  });

  it("adopts db rows and seed payloads", async () => {
    const row = {
      id: 1,
      kind: "certification",
      title: "Custom",
      subtitle: "",
      description: "",
      url: "",
      image: "",
      tags: [],
      meta: {},
      sort_order: 1,
      is_visible: true,
    };
    stubItems({ items: [row], source: "db" });
    const { result } = renderHook(() => usePublicContent("certification"));
    await waitFor(() => expect(result.current.items).toEqual([row]));
  });

  it("keeps conditional sections empty until published", async () => {
    stubItems({ items: [], source: "empty" });
    const { result } = renderHook(() => usePublicContent("blog"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
  });

  it("keeps seeds on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { result } = renderHook(() => usePublicContent("project"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((i) => i.title)).toContain("AegisStack");
  });
});
