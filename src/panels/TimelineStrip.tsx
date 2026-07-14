import type { TimelineStage, TimelineState } from "../telemetry/types";

const orderedStages: TimelineStage[] = ["standby", "launch", "burnout", "apogee", "drogue", "main", "landed"];

export default function TimelineStrip({ timeline }: { timeline: TimelineState | null }) {
  return (
    <section className="rounded-[20px] border border-white/10 bg-slate-950/50 p-2 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">Timeline</p>
        <p className="text-[10px] text-slate-300 line-clamp-1">{timeline?.message ?? "Awaiting events."}</p>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {orderedStages.map((stage) => {
          const complete = timeline?.completedStages.includes(stage) ?? false;
          const active = timeline?.currentStage === stage;
          return (
            <div key={stage} className="text-center">
              <div
                className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full border text-[8px] font-mono uppercase tracking-[0.18em] ${
                  active
                    ? "border-cyan-300 bg-cyan-300/20 text-cyan-100"
                    : complete
                      ? "border-emerald-300 bg-emerald-300/20 text-emerald-100"
                      : "border-white/10 bg-white/5 text-slate-400"
                }`}
              >
                {stage.slice(0, 2)}
              </div>
              <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-slate-400">{stage}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
