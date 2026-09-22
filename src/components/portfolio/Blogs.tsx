import { Section } from "./Section";
import { PenLine, ExternalLink } from "lucide-react";
import { usePublicContent } from "@/hooks/use-content";

/**
 * Hidden until you publish at least one visible blog post from /admin.
 */
export function Blogs() {
  const { items, loading } = usePublicContent("blog");

  if (loading && items.length === 0) return null;
  if (items.length === 0) return null;

  return (
    <Section
      id="blogs"
      eyebrow="07 / Writing"
      title={
        <>
          Notes & <span className="text-gradient">blogs</span>.
        </>
      }
      description="Short-form notes on security, DevOps and building in public."
    >
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((post, i) => (
          <article
            key={String(post.id)}
            className="reveal card-hover group relative glass rounded-2xl p-6 hover:-translate-y-1 hover:shadow-glow overflow-hidden"
            style={{ transitionDelay: `${i * 60}ms` }}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-cyan/[0.06] via-transparent to-violet/[0.08]" />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <div className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-cyan/20 to-violet/20 border border-border shrink-0">
                  <PenLine size={16} />
                </div>
                {post.url ? (
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1 hover:bg-muted"
                    aria-label={`Read ${post.title}`}
                  >
                    Read
                    <ExternalLink size={12} />
                  </a>
                ) : null}
              </div>
              <h3 className="mt-4 text-base font-semibold leading-snug">{post.title}</h3>
              {post.subtitle && (
                <div className="mt-1 font-mono text-xs text-muted-foreground">{post.subtitle}</div>
              )}
              {post.description && (
                <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed line-clamp-3">
                  {post.description}
                </p>
              )}
              {post.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {post.tags.slice(0, 5).map((t) => (
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
