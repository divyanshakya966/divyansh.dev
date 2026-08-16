export function Footer() {
  return (
    <footer className="border-t border-border mt-10">
      <div
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 2rem)" }}
        className="mx-auto max-w-6xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground"
      >
        <div className="font-mono">
          © {new Date().getFullYear()} Divyansh Shakya — built with care.
        </div>
        <div className="font-mono">
          crafted in <span className="text-gradient">vim & vite</span>
        </div>
      </div>
    </footer>
  );
}
