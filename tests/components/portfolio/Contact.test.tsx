import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Contact } from "@/components/portfolio/Contact";
import { Toaster } from "@/components/ui/sonner";

function renderContact() {
  render(
    <>
      <Contact />
      <Toaster />
    </>,
  );
}

function fillForm(user: ReturnType<typeof userEvent.setup>) {
  return user
    .type(screen.getByLabelText("Name"), "Test User")
    .then(() =>
      user
        .type(screen.getByLabelText("Email"), "test@example.com")
        .then(() => user.type(screen.getByLabelText("Message"), "Hello there!")),
    );
}

const mockFetch = (response: Partial<Response>, ok = true) => {
  const fn = vi.fn().mockResolvedValue({ ok, ...response });
  vi.stubGlobal("fetch", fn);
  return fn;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Contact", () => {
  it("renders the section and form fields", () => {
    renderContact();
    expect(screen.getByText("07 / Contact")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeRequired();
    expect(screen.getByLabelText("Email")).toBeRequired();
    expect(screen.getByLabelText("Message")).toBeRequired();
  });

  it("renders social links with correct hrefs", () => {
    renderContact();
    expect(screen.getByRole("link", { name: /Email/ })).toHaveAttribute(
      "href",
      "mailto:divyanshakya.dev@gmail.com",
    );
    expect(screen.getByRole("link", { name: /GitHub/ })).toHaveAttribute(
      "href",
      "https://github.com/divyanshakya966",
    );
    expect(screen.getByRole("link", { name: /LinkedIn/ })).toHaveAttribute(
      "href",
      "https://www.linkedin.com/in/divyanshakya966",
    );
  });

  it("submits the form payload to /api/contact on success", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({ json: async () => ({}) });
    renderContact();
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/contact",
        expect.objectContaining({
          method: "POST",
          headers: { "content-type": "application/json" },
        }),
      );
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init!.body as string)).toEqual({
      name: "Test User",
      email: "test@example.com",
      message: "Hello there!",
      company: "",
    });
    expect(await screen.findByText(/Message sent/)).toBeInTheDocument();
  });

  it("shows an error toast when the request fails", async () => {
    const user = userEvent.setup();
    mockFetch({ json: async () => ({}) }, false);
    renderContact();
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("Unable to send message right now")).toBeInTheDocument();
  });

  it("shows a rate-limit message on 429 with server detail", async () => {
    const user = userEvent.setup();
    const fn = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: "Slow down!" }),
    });
    vi.stubGlobal("fetch", fn);
    renderContact();
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("Slow down!")).toBeInTheDocument();
  });

  it("re-enables the submit button after a failed request", async () => {
    const user = userEvent.setup();
    mockFetch({ json: async () => ({}) }, false);
    renderContact();
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText("Unable to send message right now");
    expect(screen.getByRole("button", { name: "Send message" })).not.toBeDisabled();
  });

  it("does not leak the honeypot company field", () => {
    renderContact();
    const honeypot = document.querySelector<HTMLElement>('input[name="company"]');
    expect(honeypot).not.toBeNull();
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot).toHaveAttribute("aria-hidden", "true");
  });
});
