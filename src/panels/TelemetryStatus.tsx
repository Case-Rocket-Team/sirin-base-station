import PacketHealth from "./PacketHealth";
import type { LinkStatus, SirinPacket, TelemetrySource } from "../telemetry/types";

type Props = {
  source: TelemetrySource;
  status: LinkStatus | null;
  packet: SirinPacket | null;
  expectedPacketsPerSecond: number;
  staleTimeoutMs: number;
};

export default function TelemetryStatus({ source, status, packet, expectedPacketsPerSecond, staleTimeoutMs }: Props) {
  return (
    <div className="space-y-1">
      <PacketHealth
        source={source}
        status={status}
        packet={packet}
        expectedPacketsPerSecond={expectedPacketsPerSecond}
        staleTimeoutMs={staleTimeoutMs}
      />

      <aside className="rounded-[20px] border border-white/10 bg-slate-950/55 p-2 backdrop-blur">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">{source.toUpperCase()} Detail</p>
        <div className="mt-1 space-y-1">
          <StatusPill label={status?.state ?? "disconnected"} tone={statusTone(status?.state ?? "disconnected")} />
          <div className="rounded-lg border border-white/8 bg-black/20 p-2 text-xs text-slate-300">
            <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-slate-400">Message</p>
            <p className="mt-1 text-[10px] text-slate-200 line-clamp-2">{status?.message ?? "Waiting..."}</p>
          </div>
          <div className="rounded-lg border border-white/8 bg-black/20 p-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-slate-400">Snapshot</p>
            <dl className="mt-1 grid grid-cols-2 gap-1 text-[9px] text-slate-200">
              <div>
                <dt className="text-slate-400 text-[8px]">Callsign</dt>
                <dd className="text-[9px]">{packet?.callsign ?? "--"}</dd>
              </div>
              <div>
                <dt className="text-slate-400 text-[8px]">Mode</dt>
                <dd className="text-[9px]">{packet?.fields.flightMode ?? "--"}</dd>
              </div>
              <div>
                <dt className="text-slate-400 text-[8px]">Lat</dt>
                <dd className="text-[8px]">{displayMaybeFloat(packet?.fields.latitudeDeg, 3)}</dd>
              </div>
              <div>
                <dt className="text-slate-400 text-[8px]">Lon</dt>
                <dd className="text-[8px]">{displayMaybeFloat(packet?.fields.longitudeDeg, 3)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </aside>
    </div>
  );
}

function statusTone(state: string) {
  if (state === "connected") {
    return "emerald";
  }
  if (state === "connecting") {
    return "amber";
  }
  if (state === "error") {
    return "rose";
  }
  return "slate";
}

function StatusPill({ label, tone }: { label: string; tone: "emerald" | "amber" | "rose" | "slate" }) {
  const styles = {
    emerald: "border-emerald-400/40 bg-emerald-400/15 text-emerald-200",
    amber: "border-amber-400/40 bg-amber-400/15 text-amber-100",
    rose: "border-rose-400/40 bg-rose-400/15 text-rose-100",
    slate: "border-slate-400/20 bg-slate-400/10 text-slate-200",
  };
  return <div className={`inline-flex rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.3em] ${styles[tone]}`}>{label}</div>;
}

function displayMaybeFloat(value: number | null | undefined, digits: number) {
  return typeof value === "number" ? value.toFixed(digits) : "--";
}

