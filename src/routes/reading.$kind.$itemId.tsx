import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { usePublicContent } from "@/hooks/use-content";
import { isContentKind } from "@/lib/content";
import { site } from "@/lib/site";

export const Route = createFileRoute("/reading/$kind/$itemId")({
  head: ({ params }) => ({
    meta: [{ title: `Reading | ${site.name}` }, { name: "robots", content: "noindex, follow" }],
  }),
  component: ReaderPage,
});

function ReaderPage() {
  const { kind, itemId } = Route.useParams();
  const validKind = isContentKind(kind) && (kind === "research" || kind === "blog") ? kind : null;
  const { items, loading } = usePublicContent((validKind ?? "blog") as "research" | "blog");
  const item = validKind ? items.find((i) => String(i.id) === itemId) : undefined;

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 sm:px-8 py-10">
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-lg glass px-3 py-2 text-sm hover:bg-muted"
        >
          <ArrowLeft size={14} /> Home
        </a>
        {loading && !item ? (
          <p className="mt-10 font-mono text-sm text-muted-foreground">Loading…</p>
        ) : !item ? (
          <div className="mt-10">
            <h1 className="text-2xl font-bold tracking-tight">Not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This piece is unavailable — it may have been unpublished.
            </p>
          </div>
        ) : (
          <article className="mt-8">
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {validKind === "research" ? "Research" : "Notes"} · {item.subtitle || "divyansh.dev"}
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
              {item.title}
            </h1>
            {item.tags.length > 0 && (
              <div className="mt-4 font-mono text-xs text-muted-foreground">
                {item.tags.join(" · ")}
              </div>
            )}
            <p className="mt-6 text-base sm:text-lg leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {item.description}
            </p>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-8 inline-flex items-center gap-2 rounded-xl glass px-4 py-2.5 text-sm hover:bg-muted"
              >
                <ExternalLink size={14} /> Source
              </a>
            )}
          </article>
        )}
      </div>
    </main>
  );
}
