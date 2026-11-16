import type { AppPage, TelemetrySource } from "../telemetry/types";

type Props = {
  activePage: AppPage;
  activePageDescription: string;
  pages: Array<{ id: AppPage; label: string; description: string }>;
  selectedSource: TelemetrySource;
  onPageChange: (page: AppPage) => void;
  onSourceChange: (source: TelemetrySource) => void;
};

export default function InitializationPanel({
  activePage,
  activePageDescription,
  pages,
  selectedSource,
  onPageChange,
  onSourceChange,
}: Props) {
  return (
    <header className="rounded-[20px] border border-white/10 bg-slate-950/55 p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.45em] text-cyan-300/80">
            Case Rocket Team
          </p>
          <h1 className="font-mono text-base font-semibold uppercase tracking-[0.22em] text-white leading-tight">
            Sirin Base
          </h1>
          <p className="text-[9px] text-slate-300/80 line-clamp-1">
            {activePageDescription}
          </p>
        </div>

        <nav className="grid grid-cols-7 gap-0.5 flex-shrink-0">
          {pages.map((page) => {
            const active = page.id === activePage;
            return (
              <button
                key={page.id}
                onClick={() => onPageChange(page.id)}
                className={`rounded-lg border px-1 py-1 text-center transition ${
                  active
                    ? "border-cyan-300/50 bg-cyan-300/15 text-white shadow-[0_0_24px_rgba(34,211,238,0.12)]"
                    : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-300/30 hover:bg-white/8"
                }`}
              >
                <span className="block font-mono text-[8px] uppercase tracking-[0.3em]">
                  {page.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex gap-0.5 rounded-lg border border-white/10 bg-black/20 p-0.5 flex-shrink-0">
          {(["lora", "usb"] as const).map((source) => {
            const active = source === selectedSource;
            return (
              <button
                key={source}
                onClick={() => onSourceChange(source)}
                className={`rounded-lg px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.25em] transition ${
                  active
                    ? "bg-emerald-400/20 text-emerald-200"
                    : "text-slate-300 hover:bg-white/5"
                }`}
              >
                {source}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
