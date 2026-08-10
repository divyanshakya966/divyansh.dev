import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

function fireToast(kind: "success" | "error" | "default") {
  if (kind === "success") toast.success("Saved!");
  else if (kind === "error") toast.error("Failed!");
  else toast("Plain toast");
}

describe("Toaster (sonner wrapper)", () => {
  it("renders without crashing", () => {
    render(<Toaster />);
    expect(document.body).toBeInTheDocument();
  });

  it("displays a success toast", async () => {
    render(<Toaster />);
    fireToast("success");
    expect(await screen.findByText("Saved!")).toBeInTheDocument();
  });

  it("displays an error toast", async () => {
    render(<Toaster />);
    fireToast("error");
    expect(await screen.findByText("Failed!")).toBeInTheDocument();
  });

  it("displays a default toast", async () => {
    render(<Toaster />);
    fireToast("default");
    expect(await screen.findByText("Plain toast")).toBeInTheDocument();
  });

  it("auto-dismisses the toast after its duration elapses", async () => {
    render(<Toaster />);
    toast("Short toast", { duration: 200 });
    const toastEl = await screen.findByText("Short toast");
    expect(toastEl).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Short toast")).not.toBeInTheDocument(), {
      timeout: 3000,
    });
  });
});
