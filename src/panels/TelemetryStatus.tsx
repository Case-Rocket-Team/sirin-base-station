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
    <div className="space-y-4">
      <PacketHealth
        source={source}
        status={status}
        packet={packet}
        expectedPacketsPerSecond={expectedPacketsPerSecond}
        staleTimeoutMs={staleTimeoutMs}
      />

      <aside className="rounded-[28px] border border-white/10 bg-slate-950/55 p-4 backdrop-blur">
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-200/75">{source.toUpperCase()} Link Detail</p>
        <div className="mt-4 space-y-4">
          <StatusPill label={status?.state ?? "disconnected"} tone={statusTone(status?.state ?? "disconnected")} />
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-300">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-slate-400">Latest Message</p>
            <p className="mt-2 text-sm text-slate-200">{status?.message ?? "Waiting for listener update."}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-slate-400">Packet Snapshot</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-200">
              <div>
                <dt className="text-slate-400">Callsign</dt>
                <dd>{packet?.callsign ?? "--"}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Mode</dt>
                <dd>{packet?.fields.flightMode ?? "--"}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Lat</dt>
                <dd>{displayMaybeFloat(packet?.fields.latitudeDeg, 5)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Lon</dt>
                <dd>{displayMaybeFloat(packet?.fields.longitudeDeg, 5)}</dd>
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
  return <div className={`inline-flex rounded-full border px-4 py-2 font-mono text-xs uppercase tracking-[0.3em] ${styles[tone]}`}>{label}</div>;
}

function displayMaybeFloat(value: number | null | undefined, digits: number) {
  return typeof value === "number" ? value.toFixed(digits) : "--";
}

