import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { usePublicContent, useSiteSettings } from "@/hooks/use-content";
import { isSectionVisible } from "@/lib/settings";
import { safeHref } from "@/lib/utils";
import { site } from "@/lib/site";

export const Route = createFileRoute("/resume")({
  head: () => ({
    meta: [
      { title: `Resume | ${site.name}` },
      {
        name: "description",
        content: `Resume of ${site.name} — rendered from live portfolio data.`,
      },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: ResumePage,
});

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground border-b border-white/10 pb-2">
        {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function ResumePage() {
  const { settings } = useSiteSettings();
  const { items: experience } = usePublicContent("experience");
  const { items: projects } = usePublicContent("project");
  const { items: skills } = usePublicContent("skill");
  const { items: certs } = usePublicContent("certification");

  const emailRaw = (settings.contact_email ?? "").trim();
  const email = emailRaw.includes("@") ? emailRaw : "divyanshakya.dev@gmail.com";
  const github = safeHref(settings.social_github ?? "", "https://github.com/divyanshakya966");
  const linkedin = safeHref(
    settings.social_linkedin ?? "",
    "https://www.linkedin.com/in/divyanshakya966",
  );

  return (
    <main className="resume-page relative min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-5 sm:px-8 py-10 print:py-0">
        <div className="print:hidden flex items-center justify-between gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-lg glass px-3 py-2 text-sm hover:bg-muted"
          >
            <ArrowLeft size={14} /> Site
          </a>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            <Printer size={14} /> Print / Save PDF
          </button>
        </div>

        <header className="mt-8 print:mt-0">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Divyansh Shakya</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aspiring Security Engineer · DevSecOps · Linux · Cloud
          </p>
          <p className="mt-2 font-mono text-xs text-muted-foreground print:text-black">
            {email} · {github.replace("https://", "")} · {linkedin.replace("https://", "")} ·
            Bhopal, India
          </p>
        </header>

        {isSectionVisible(settings, "experience") && experience.length > 0 && (
          <Block title="Experience">
            {experience.map((it) => {
              const meta = it.meta ?? {};
              const when = typeof meta.when === "string" ? meta.when : it.subtitle;
              const bullets = Array.isArray(meta.bullets)
                ? meta.bullets.filter((b): b is string => typeof b === "string")
                : [];
              return (
                <div key={String(it.id)}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold">{it.title}</h3>
                    <span className="font-mono text-xs text-muted-foreground">{when}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">{it.subtitle}</div>
                  <p className="mt-1 text-sm leading-relaxed">{it.description}</p>
                  {bullets.length > 0 && (
                    <ul className="mt-1.5 list-disc pl-5 text-sm leading-relaxed">
                      {bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </Block>
        )}

        {isSectionVisible(settings, "projects") && projects.length > 0 && (
          <Block title="Projects">
            {projects.map((p) => (
              <div key={String(p.id)}>
                <h3 className="font-semibold">{p.title}</h3>
                <p className="mt-1 text-sm leading-relaxed">{p.description}</p>
                {p.tags.length > 0 && (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {p.tags.join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </Block>
        )}

        {isSectionVisible(settings, "skills") && skills.length > 0 && (
          <Block title="Skills">
            {skills.map((g) => (
              <div key={String(g.id)} className="text-sm">
                <span className="font-semibold">{g.title}:</span>{" "}
                <span className="text-muted-foreground">{g.tags.join(", ")}</span>
              </div>
            ))}
          </Block>
        )}

        {isSectionVisible(settings, "certifications") && certs.length > 0 && (
          <Block title="Certifications">
            {certs.map((c) => (
              <div key={String(c.id)} className="text-sm">
                <span className="font-semibold">{c.title}</span>
                {c.subtitle && <span className="text-muted-foreground"> — {c.subtitle}</span>}
              </div>
            ))}
          </Block>
        )}

        <footer className="mt-10 border-t border-white/10 pt-4 font-mono text-[11px] text-muted-foreground print:hidden">
          Live render of portfolio data · {site.url}/resume · generated{" "}
          {new Date().toLocaleDateString()}
        </footer>
      </div>
    </main>
  );
}
