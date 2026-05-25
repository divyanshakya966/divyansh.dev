import { useState } from "react";
import { Section } from "./Section";
import { ArrowUpRight, Github, Linkedin, Mail, Send } from "lucide-react";
import { toast } from "sonner";

export function Contact() {
  const [sending, setSending] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      message: String(formData.get("message") ?? "").trim(),
      company: String(formData.get("company") ?? "").trim(),
    };

    setSending(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Unable to send message right now");
      }

      form.reset();
      toast.success("Message sent — I'll get back to you soon.");
    } catch {
      toast.error("Couldn't send message. Please try again in a moment.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Section
      id="contact"
      eyebrow="07 / Contact"
      title={<>Let's <span className="text-gradient">build</span> something.</>}
      description="Open to internships, hackathons and open source collaborations."
    >
      <div className="grid lg:grid-cols-5 gap-6">
        <form
          onSubmit={onSubmit}
          className="reveal lg:col-span-3 glass rounded-2xl p-6 sm:p-8 space-y-4"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Name" name="name" required />
            <Field label="Email" name="email" type="email" required />
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Message
            </label>
            <textarea
              name="message"
              required
              rows={5}
              className="mt-2 w-full rounded-xl bg-background/40 border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition resize-none"
              placeholder="Tell me about the role, hackathon, or project..."
            />
          </div>
          <input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-primary-foreground bg-gradient-to-r from-cyan to-violet shadow-glow hover:scale-[1.02] transition-transform disabled:opacity-60"
            >
              <Send size={15} /> {sending ? "Sending..." : "Send message"}
            </button>
            <a
              href="/resume/resume.pdf"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium glass hover:bg-muted"
            >
              <ArrowUpRight size={15} /> Resume
            </a>
          </div>
        </form>

        <div className="reveal lg:col-span-2 space-y-3">
          <SocialLink href="mailto:divyanshakya.dev@gmail.com" icon={Mail} label="Email" sub="divyanshakya.dev@gmail.com" />
          <SocialLink href="https://github.com/divyanshakya966" icon={Github} label="GitHub" sub="@divyanshakya966" />
          <SocialLink href="https://www.linkedin.com/in/divyanshakya966" icon={Linkedin} label="LinkedIn" sub="in/divyanshakya966" />
          <div className="glass rounded-2xl p-5 mt-2">
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan" />
              </span>
              AVAILABLE · Bhopal, India
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Open to cybersecurity, DevSecOps and full-stack internships, hackathons and meaningful OSS work.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Field({ label, name, type = "text", required }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-2 w-full rounded-xl bg-background/40 border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition"
      />
    </div>
  );
}

function SocialLink({ href, icon: Icon, label, sub }: { href: string; icon: any; label: string; sub: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center gap-4 glass rounded-2xl p-4 hover:shadow-glow hover:-translate-y-0.5 transition-all"
    >
      <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-cyan/20 to-violet/20 border border-border">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground truncate">{sub}</div>
      </div>
      <span className="ml-auto text-xs text-muted-foreground group-hover:text-foreground transition-colors">→</span>
    </a>
  );
}
