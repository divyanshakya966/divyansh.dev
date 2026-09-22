import { Section } from "./Section";
import { FileText, ExternalLink } from "lucide-react";
import { usePublicContent } from "@/hooks/use-content";

/**
 * Hidden until you publish at least one visible research item from /admin.
 * Returns null while empty so the nav + layout stay clean.
 */
export function Research() {
  const { items, loading } = usePublicContent("research");

  if (loading && items.length === 0) return null;
  if (items.length === 0) return null;

  return (
    <Section
      id="research"
      eyebrow="06 / Research"
      title={
        <>
          Research & <span className="text-gradient">papers</span>.
        </>
      }
      description="Write-ups, findings and papers — published from the admin panel."
    >
      <div className="grid md:grid-cols-2 gap-5">
        {items.map((paper, i) => (
          <article
            key={String(paper.id)}
            className="reveal card-hover group relative glass rounded-2xl p-6 hover:-translate-y-1 hover:shadow-glow overflow-hidden"
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-cyan/[0.06] via-transparent to-violet/[0.08]" />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <div className="grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br from-cyan/20 to-violet/20 border border-border shrink-0">
                  <FileText size={18} />
                </div>
                {paper.url && (
                  <a
                    href={paper.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1 hover:bg-muted"
                    aria-label={`Read ${paper.title}`}
                  >
                    Read
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
              <h3 className="mt-4 text-lg font-semibold leading-snug">{paper.title}</h3>
              {paper.subtitle && (
                <div className="mt-1 font-mono text-xs text-muted-foreground">{paper.subtitle}</div>
              )}
              {paper.description && (
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed line-clamp-4">
                  {paper.description}
                </p>
              )}
              {paper.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {paper.tags.map((t) => (
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
