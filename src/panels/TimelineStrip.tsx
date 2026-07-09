import type { TimelineStage, TimelineState } from "../telemetry/types";

const orderedStages: TimelineStage[] = ["standby", "launch", "burnout", "apogee", "drogue", "main", "landed"];

export default function TimelineStrip({ timeline }: { timeline: TimelineState | null }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-slate-950/50 p-4 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-200/75">Mission Timeline</p>
        <p className="text-sm text-slate-300">{timeline?.message ?? "Awaiting mission events."}</p>
      </div>
      <div className="mt-5 grid grid-cols-7 gap-2">
        {orderedStages.map((stage) => {
          const complete = timeline?.completedStages.includes(stage) ?? false;
          const active = timeline?.currentStage === stage;
          return (
            <div key={stage} className="text-center">
              <div
                className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full border text-[10px] font-mono uppercase tracking-[0.18em] ${
                  active
                    ? "border-cyan-300 bg-cyan-300/20 text-cyan-100"
                    : complete
                      ? "border-emerald-300 bg-emerald-300/20 text-emerald-100"
                      : "border-white/10 bg-white/5 text-slate-400"
                }`}
              >
                {stage.slice(0, 2)}
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">{stage}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
