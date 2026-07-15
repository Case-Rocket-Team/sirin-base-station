import TelemetryStatus from "./TelemetryStatus";
import { useTelemetrySource } from "../telemetry/useTelemetrySource";
import type { TelemetrySource, TimelineStage } from "../telemetry/types";

const orderedStages: TimelineStage[] = ["standby", "launch", "burnout", "apogee", "drogue", "main", "landed"];

type Props = {
  selectedSource: TelemetrySource;
};

export default function TimelinePanel({ selectedSource }: Props) {
  const telemetry = useTelemetrySource(selectedSource);
  const timeline = telemetry.timelineState;

  return (
    <div className="responsive-panel-grid responsive-panel-grid-timeline">
      <TelemetryStatus
        source={selectedSource}
        status={telemetry.status}
        packet={telemetry.packet}
        expectedPacketsPerSecond={telemetry.snapshot?.config.expectedPacketsPerSecond ?? 10}
        staleTimeoutMs={telemetry.snapshot?.config.staleTimeoutMs ?? 3000}
      />

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
                    {stage.slice(0, 2)}
                  </div>
                  <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.18em] text-slate-300">{stage}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-2 grid gap-1 grid-cols-3">
          <StageCard label="Current Stage" value={timeline?.currentStage ?? "--"} />
          <StageCard label="Last Update" value={formatAge(timeline?.lastUpdateMs ?? null)} />
          <StageCard label="Packet Mode" value={telemetry.packet?.fields.flightMode ?? "--"} />
        </div>
      </section>
    </div>
  );
}

function progressPercent(stage: TimelineStage) {
  return (orderedStages.indexOf(stage) / Math.max(orderedStages.length - 1, 1)) * 100;
}

function formatAge(value: number | null) {
  return value ? `${Math.max(0, (Date.now() - value) / 1000).toFixed(1)} s ago` : "--";
}

function StageCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/25 p-1.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

