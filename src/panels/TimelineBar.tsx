import type { TimelineStage, TimelineState } from "../telemetry/types";

const orderedStages: TimelineStage[] = ["standby", "launch", "burnout", "apogee", "drogue", "main", "landed"];

type Props = {
  timeline: TimelineState | null;
};

export default function TimelineBar({ timeline }: Props) {
  return (
    <section className="rounded-[20px] border border-white/10 bg-slate-950/55 p-2 backdrop-blur">
      <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">Flight Timeline</p>
      <p className="mt-0.5 text-[10px] text-slate-300">{timeline?.message ?? "Waiting..."}</p>

      <div className="relative mt-2">
        <div className="absolute left-0 right-0 top-2 h-0.5 bg-white/10" />
        <div
          className="absolute left-0 top-2 h-0.5 bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.5)] transition-all"
          style={{ width: `${progressPercent(timeline?.currentStage ?? "standby")}%` }}
        />

        <div className="grid grid-cols-7 gap-1">
          {orderedStages.map((stage) => {
            const complete = timeline?.completedStages.includes(stage) ?? false;
            const active = timeline?.currentStage === stage;
            return (
              <div key={stage} className="text-center">
                <div
                  className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full border text-[8px] font-mono uppercase tracking-[0.16em] ${
                    active
                      ? "border-cyan-300 bg-cyan-300/20 text-cyan-100 shadow-[0_0_20px_rgba(103,232,249,0.35)]"
                      : complete
                        ? "border-emerald-300 bg-emerald-300/20 text-emerald-100"
                        : "border-white/10 bg-white/5 text-slate-400"
                  }`}
                >
                  {stage.charAt(0).toUpperCase()}
                </div>
                <p className="mt-1 text-[7px] uppercase text-slate-400">{stage.slice(0, 3)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function progressPercent(stage: TimelineStage): number {
  const index = orderedStages.indexOf(stage);
  if (index < 0) return 0;
  return ((index + 1) / orderedStages.length) * 100;
}
