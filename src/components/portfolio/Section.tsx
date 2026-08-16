import type { ReactNode } from "react";

export function Section({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="relative py-24 sm:py-32 xl:py-36 2xl:py-48 scroll-mt-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="reveal-stagger max-w-2xl mb-14">
          <div className="reveal font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 flex items-center gap-3">
            <span className="inline-block h-px w-8 bg-foreground/40" />
            <span>{eyebrow}</span>
          </div>
          <h2
            className="reveal text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-[1.15] pb-[0.08em]"
            data-reveal="blur"
          >
            {title}
          </h2>
          {description && (
            <p className="reveal mt-4 text-base sm:text-lg text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="reveal-stagger">{children}</div>
      </div>
    </section>
  );
}
