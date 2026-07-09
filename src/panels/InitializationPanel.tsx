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
    <header className="rounded-[28px] border border-white/10 bg-slate-950/55 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.45em] text-cyan-300/80">
            Case Rocket Team
          </p>
          <h1 className="mt-2 font-mono text-2xl font-semibold uppercase tracking-[0.22em] text-white sm:text-3xl">
            Sirin Base Station
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300/80 sm:text-base">
            {activePageDescription}
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <nav className="grid grid-cols-2 gap-2 lg:grid-cols-7">
            {pages.map((page) => {
              const active = page.id === activePage;
              return (
                <button
                  key={page.id}
                  onClick={() => onPageChange(page.id)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-cyan-300/50 bg-cyan-300/15 text-white shadow-[0_0_24px_rgba(34,211,238,0.12)]"
                      : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-300/30 hover:bg-white/8"
                  }`}
                >
                  <span className="block font-mono text-xs uppercase tracking-[0.3em]">
                    {page.label}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="flex gap-2 rounded-2xl border border-white/10 bg-black/20 p-1">
            {(["lora", "usb"] as const).map((source) => {
              const active = source === selectedSource;
              return (
                <button
                  key={source}
                  onClick={() => onSourceChange(source)}
                  className={`rounded-xl px-4 py-2 font-mono text-xs uppercase tracking-[0.25em] transition ${
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
      </div>
    </header>
  );
}
