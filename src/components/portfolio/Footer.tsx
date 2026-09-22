import { useSiteSettings } from "@/hooks/use-content";
import { safeHref } from "@/lib/utils";

const DEFAULT_REPO = "https://github.com/divyanshakya966/divyansh.dev";

export function Footer() {
  const { settings } = useSiteSettings();
  const repo = safeHref(settings.footer_repo ?? "", DEFAULT_REPO) || DEFAULT_REPO;
  return (
    <footer className="border-t border-border mt-10">
      <div
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 2rem)" }}
        className="mx-auto max-w-6xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground"
      >
        <div className="font-mono">© {new Date().getFullYear()} Divyansh Shakya</div>
        <div className="font-mono">
          Crafting open-source software. Feel free to star the repo on{" "}
          <a
            href={repo}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gradient hover:underline"
          >
            GitHub
          </a>
          !
        </div>
      </div>
    </footer>
  );
}
