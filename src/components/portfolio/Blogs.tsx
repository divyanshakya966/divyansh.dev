import { Section } from "./Section";
import { Reveal } from "./Reveal";
import { PenLine, ExternalLink } from "lucide-react";
import { usePublicContent, useSiteSettings } from "@/hooks/use-content";
import { isSectionVisible } from "@/lib/settings";

/**
 * Hidden until you publish at least one visible blog post from /admin.
 */
export function Blogs() {
  const { items, loading } = usePublicContent("blog");
  const { settings } = useSiteSettings();

  if (!isSectionVisible(settings, "blogs")) return null;
  if (loading && items.length === 0) return null;
  if (items.length === 0) return null;

  return (
    <Section
      id="blogs"
      eyebrow="09 / Writing"
      title={
        <>
          Notes & <span className="text-gradient">blogs</span>.
        </>
      }
      description="Short-form notes on security, DevOps and building in public."
    >
      <div className="border-t border-white/10">
        {items.map((post, i) => (
          <Reveal key={String(post.id)} variant="up" delay={Math.min(i * 0.05, 0.25)}>
            <article className="group grid sm:grid-cols-[auto_1fr_auto] items-start sm:items-center gap-3 sm:gap-5 border-b border-white/10 px-2 sm:px-4 py-5 transition-colors duration-300 hover:bg-white/[0.03]">
              <span className="hidden sm:block font-mono text-xs text-muted-foreground tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  <PenLine size={12} aria-hidden="true" />
                  <span className="truncate">{post.subtitle || "Note"}</span>
                </div>
                <h3 className="mt-1.5 text-base sm:text-lg font-semibold tracking-tight leading-snug decoration-white/40 underline-offset-4 group-hover:underline">
                  {post.title}
                </h3>
                {post.description && (
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed line-clamp-2 max-w-3xl">
                    {post.description}
                  </p>
                )}
              </div>
              {post.url ? (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`Read ${post.title}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 font-mono text-xs text-muted-foreground transition-all duration-300 hover:border-white hover:bg-white hover:text-black"
                >
                  Read
                  <ExternalLink size={12} />
                </a>
              ) : null}
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
