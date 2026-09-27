import { Quote } from "lucide-react";
import { Section } from "./Section";
import { Reveal } from "./Reveal";
import { usePublicContent, useSiteSettings } from "@/hooks/use-content";
import { isSectionVisible } from "@/lib/settings";

/**
 * Kind words — hidden until at least one visible testimonial is published
 * from /admin (same conditional pattern as research/blogs).
 * Title = person, subtitle = role/org, description = quote, url = profile.
 */
export function Testimonials() {
  const { items, loading } = usePublicContent("testimonial");
  const { settings } = useSiteSettings();

  if (!isSectionVisible(settings, "testimonials")) return null;
  if (loading && items.length === 0) return null;
  if (items.length === 0) return null;

  const [featured, ...rest] = items;

  return (
    <Section
      id="testimonials"
      eyebrow="10 / Kind words"
      title={
        <>
          What people <span className="text-gradient">say</span>.
        </>
      }
      description="Recommendations from mentors, teammates and collaborators."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {featured && (
          <Reveal variant="blur" className="lg:row-span-2">
            <figure className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 transition-colors duration-300 hover:border-white/25">
              <Quote size={28} aria-hidden="true" className="text-white/25" />
              <blockquote className="mt-5 text-lg sm:text-2xl font-medium leading-snug tracking-tight">
                “{featured.description}”
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid place-items-center h-10 w-10 rounded-full border border-white/15 bg-white/[0.05] font-mono text-xs"
                >
                  {featured.title.charAt(0).toUpperCase()}
                </span>
                <span>
                  <span className="block text-sm font-semibold">
                    {featured.url ? (
                      <a
                        href={featured.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="underline-offset-4 hover:underline"
                      >
                        {featured.title}
                      </a>
                    ) : (
                      featured.title
                    )}
                  </span>
                  {featured.subtitle && (
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      {featured.subtitle}
                    </span>
                  )}
                </span>
              </figcaption>
            </figure>
          </Reveal>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {rest.slice(0, 4).map((t, i) => (
            <Reveal key={String(t.id)} variant="up" delay={Math.min(i * 0.06, 0.24)}>
              <figure className="group h-full rounded-2xl border border-white/10 bg-white/[0.015] p-5 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.03] hover:-translate-y-0.5">
                <blockquote className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                  “{t.description}”
                </blockquote>
                <figcaption className="mt-4">
                  <span className="block text-sm font-semibold">{t.title}</span>
                  {t.subtitle && (
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      {t.subtitle}
                    </span>
                  )}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
