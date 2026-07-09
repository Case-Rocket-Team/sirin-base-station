import type { LinkStatus, SirinPacket, TelemetrySource } from "../telemetry/types";

type Props = {
  source: TelemetrySource;
  status: LinkStatus | null;
  packet: SirinPacket | null;
  expectedPacketsPerSecond: number;
  staleTimeoutMs: number;
};

export default function PacketHealth({ source, status, packet, expectedPacketsPerSecond, staleTimeoutMs }: Props) {
  const stale = Boolean(status?.lastPacketAtMs && Date.now() - status.lastPacketAtMs > staleTimeoutMs);
  const packetsPerSecond = status?.connected ? status.packetsPerSecond : 0;
  const strength =
    stale || packetsPerSecond <= 0 ? "No Signal" : packetsPerSecond > expectedPacketsPerSecond * 0.5 ? "Good" : "Poor";

  return (
    <aside className="rounded-[28px] border border-white/10 bg-slate-950/55 p-4 backdrop-blur">
      <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-200/75">{source.toUpperCase()} Packet Health</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricCard label="Strength" value={strength} />
        <MetricCard label="Packets/s" value={packetsPerSecond.toFixed(1)} />
        <MetricCard label="Last Packet" value={status?.lastPacketAtMs ? `${((Date.now() - status.lastPacketAtMs) / 1000).toFixed(1)} s` : "--"} />
        <MetricCard label="GPS Sats" value={display(packet?.fields.gpsSatelliteCount)} />
        <MetricCard label="Rejected" value={display(status?.rejectedPacketCount)} />
        <MetricCard label="Dropped" value={display(status?.droppedPacketCount)} />
      </div>
    </aside>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function display(value: number | null | undefined) {
  return typeof value === "number" ? String(value) : "--";
}

