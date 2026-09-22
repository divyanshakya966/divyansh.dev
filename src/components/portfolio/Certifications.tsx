import { Section } from "./Section";
import { Award, BadgeCheck, ExternalLink, ShieldCheck } from "lucide-react";
import { usePublicContent, useSiteSettings } from "@/hooks/use-content";
import { isSectionVisible } from "@/lib/settings";

export function Certifications() {
  const { items } = usePublicContent("certification");
  const { settings } = useSiteSettings();

  if (!isSectionVisible(settings, "certifications") || items.length === 0) return null;

  return (
    <Section
      id="certifications"
      eyebrow="05 / Certifications"
      title={
        <>
          Verified <span className="text-gradient">credentials</span>.
        </>
      }
      description="Industry certifications with verifiable credentials — click through to inspect each certificate."
    >
      <div className="grid md:grid-cols-2 gap-5">
        {items.map((cert, i) => (
          <article
            key={String(cert.id)}
            className="reveal card-hover group relative glass rounded-2xl p-6 hover:-translate-y-1 hover:shadow-glow overflow-hidden"
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-cyan/[0.06] via-transparent to-violet/[0.08]" />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <div className="grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br from-cyan/20 to-violet/20 border border-border shrink-0">
                  {i === 0 ? <ShieldCheck size={18} /> : <Award size={18} />}
                </div>
                {cert.url && (
                  <a
                    href={cert.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1 hover:bg-muted"
                    aria-label={`Verify ${cert.title}`}
                  >
                    <BadgeCheck size={13} />
                    Verify
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
              <h3 className="mt-4 text-lg font-semibold leading-snug">{cert.title}</h3>
              {cert.subtitle && (
                <div className="mt-1 font-mono text-xs text-muted-foreground">{cert.subtitle}</div>
              )}
              {cert.description && (
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {cert.description}
                </p>
              )}
              {cert.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {cert.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-mono text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}
