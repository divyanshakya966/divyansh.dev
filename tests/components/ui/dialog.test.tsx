import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function DemoDialog({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger>Open dialog</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Demo title</DialogTitle>
          <DialogDescription>Demo description</DialogDescription>
        </DialogHeader>
        <DialogClose>Close dialog</DialogClose>
      </DialogContent>
    </Dialog>
  );
}

describe("Dialog (Radix wrapper)", () => {
  it("renders the trigger", () => {
    render(<DemoDialog />);
    expect(screen.getByRole("button", { name: "Open dialog" })).toBeInTheDocument();
  });

  it("does not show content by default", () => {
    render(<DemoDialog />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the dialog when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<DemoDialog />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Demo title")).toBeInTheDocument();
    expect(screen.getByText("Demo description")).toBeInTheDocument();
  });

  it("closes the dialog via the DialogClose button", async () => {
    const user = userEvent.setup();
    render(<DemoDialog defaultOpen />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("titles/descriptions get proper Radix ARIA semantics", async () => {
    const user = userEvent.setup();
    render(<DemoDialog />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName("Demo title");
    expect(dialog).toHaveAccessibleDescription("Demo description");
  });
});
