import { Section } from "./Section";
import { usePublicContent, useSiteSettings } from "@/hooks/use-content";
import { isSectionVisible } from "@/lib/settings";

export function Experience() {
  const { items } = usePublicContent("experience");
  const { settings } = useSiteSettings();

  if (!isSectionVisible(settings, "experience") || items.length === 0) return null;

  return (
    <Section
      id="experience"
      eyebrow="04 / Experience"
      title={
        <>
          Training, <span className="text-gradient">open source</span> & hackathons.
        </>
      }
    >
      <div className="relative">
        <div className="absolute left-4 sm:left-1/2 sm:-translate-x-px top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
        <ul className="space-y-10">
          {items.map((it, i) => {
            const meta = it.meta ?? {};
            const when =
              typeof meta.when === "string" && meta.when.trim() ? meta.when : it.subtitle;
            const tag =
              typeof meta.tag === "string" && meta.tag.trim()
                ? meta.tag
                : (it.tags[0] ?? it.subtitle);
            return (
              <li
                key={String(it.id)}
                className="reveal relative grid sm:grid-cols-2 gap-6 sm:gap-12"
              >
                <div
                  className={`pl-12 sm:pl-0 ${
                    i % 2 === 0 ? "sm:order-1 sm:text-right sm:pr-12" : "sm:order-2 sm:pl-12"
                  }`}
                >
                  <div className="absolute left-4 sm:left-1/2 -translate-x-1/2 top-2 h-3 w-3 rounded-full bg-gradient-to-br from-cyan to-violet ring-4 ring-background" />
                  <div className="font-mono text-xs text-muted-foreground">
                    {when} · {tag}
                  </div>
                  <h3 className="mt-1 text-lg font-semibold">{it.title}</h3>
                  <div className="text-sm text-muted-foreground">{it.subtitle}</div>
                </div>
                <div
                  className={`pl-12 sm:pl-0 ${
                    i % 2 === 0 ? "sm:order-2 sm:pl-12" : "sm:order-1 sm:text-right sm:pr-12"
                  }`}
                >
                  <p className="text-sm text-muted-foreground leading-relaxed">{it.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Section>
  );
}
