import type { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  eyebrow?: string;
  title?: string;
  headerAction?: ReactNode;
  accentCorner?: boolean;
}

export function GlassCard({
  children,
  className = "",
  eyebrow,
  title,
  headerAction,
  accentCorner = true,
}: GlassCardProps) {
  return (
    <section
      className={`relative rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-glass overflow-hidden ${className}`}
    >
      {accentCorner ? (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-0 h-3 w-3 border-t border-l border-flame-orange/70 rounded-tl-2xl"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b border-r border-flame-amber/50 rounded-br-2xl"
          />
        </>
      ) : null}

      {eyebrow || title || headerAction ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            {eyebrow ? (
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-flame-orange/90">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className="font-display text-base sm:text-lg font-semibold tracking-tight text-white">
                {title}
              </h2>
            ) : null}
          </div>
          {headerAction ? <div>{headerAction}</div> : null}
        </header>
      ) : null}

      <div className="p-5">{children}</div>
    </section>
  );
}
