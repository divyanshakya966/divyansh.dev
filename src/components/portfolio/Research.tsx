import { Section } from "./Section";
import { Reveal } from "./Reveal";
import { FileText, ExternalLink } from "lucide-react";
import { usePublicContent, useSiteSettings } from "@/hooks/use-content";
import { isSectionVisible } from "@/lib/settings";

/**
 * Hidden until you publish at least one visible research item from /admin.
 * Returns null while empty so the nav + layout stay clean.
 */
export function Research() {
  const { items, loading } = usePublicContent("research");
  const { settings } = useSiteSettings();

  if (!isSectionVisible(settings, "research")) return null;
  if (loading && items.length === 0) return null;
  if (items.length === 0) return null;

  return (
    <Section
      id="research"
      eyebrow="08 / Research"
      title={
        <>
          Research & <span className="text-gradient">papers</span>.
        </>
      }
      description="Write-ups, findings and papers — published from the admin panel."
    >
      <div className="border-t border-white/10">
        {items.map((paper, i) => (
          <Reveal key={String(paper.id)} variant="up" delay={Math.min(i * 0.05, 0.25)}>
            <article className="group grid sm:grid-cols-[1fr_auto] gap-3 sm:gap-6 border-b border-white/10 px-2 sm:px-4 py-5 transition-colors duration-300 hover:bg-white/[0.03]">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  <FileText size={12} aria-hidden="true" />
                  <span className="truncate">{paper.subtitle || "Research"}</span>
                  {paper.tags[0] && (
                    <>
                      <span aria-hidden="true" className="text-white/20">
                        /
                      </span>
                      <span className="truncate text-muted-foreground/80">{paper.tags[0]}</span>
                    </>
                  )}
                </div>
                <h3 className="mt-2 text-lg sm:text-xl font-semibold tracking-tight leading-snug decoration-white/40 underline-offset-4 group-hover:underline">
                  {paper.title}
                </h3>
                {paper.description && (
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed line-clamp-2 max-w-3xl">
                    {paper.description}
                  </p>
                )}
              </div>
              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                {paper.url ? (
                  <a
                    href={paper.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`Read ${paper.title}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 font-mono text-xs text-muted-foreground transition-all duration-300 hover:border-white hover:bg-white hover:text-black"
                  >
                    Read
                    <ExternalLink size={12} />
                  </a>
                ) : (
                  <span className="font-mono text-[11px] text-muted-foreground/60">Draft</span>
                )}
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
