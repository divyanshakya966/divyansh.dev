import { Section } from "./Section";
import { Reveal } from "./Reveal";
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
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div
          aria-hidden="true"
          className="hidden sm:grid grid-cols-[1fr_auto] gap-4 border-b border-white/10 bg-white/[0.02] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground"
        >
          <span>Credential</span>
          <span>Proof</span>
        </div>
        {items.map((cert, i) => (
          <Reveal key={String(cert.id)} variant="up" delay={Math.min(i * 0.05, 0.2)}>
            <article className="group grid sm:grid-cols-[auto_1fr_auto] items-start gap-4 border-b border-white/10 bg-transparent px-5 py-5 transition-colors duration-300 last:border-b-0 hover:bg-white/[0.03]">
              <div className="hidden sm:grid place-items-center h-10 w-10 rounded-xl border border-white/10 bg-white/[0.04] shrink-0 transition-transform duration-300 group-hover:scale-110">
                {i === 0 ? <ShieldCheck size={18} /> : <Award size={18} />}
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-semibold leading-snug">{cert.title}</h3>
                {cert.subtitle && (
                  <div className="mt-1 font-mono text-xs text-muted-foreground">
                    {cert.subtitle}
                  </div>
                )}
                {cert.description && (
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-2 max-w-2xl">
                    {cert.description}
                  </p>
                )}
                {cert.tags.length > 0 && (
                  <div className="mt-2 font-mono text-[11px] text-muted-foreground/80 truncate">
                    {cert.tags.slice(0, 4).join("  ·  ")}
                  </div>
                )}
              </div>
              {cert.url ? (
                <a
                  href={cert.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`Verify ${cert.title}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 font-mono text-xs text-muted-foreground transition-all duration-300 hover:border-white hover:bg-white hover:text-black"
                >
                  <BadgeCheck size={13} />
                  Verify
                  <ExternalLink size={12} />
                </a>
              ) : (
                <span className="font-mono text-[11px] text-muted-foreground/60">—</span>
              )}
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
