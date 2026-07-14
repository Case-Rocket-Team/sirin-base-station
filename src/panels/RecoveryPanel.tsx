import { useMemo, useState } from "react";
import TelemetryStatus from "./TelemetryStatus";
import { useTelemetrySource } from "../telemetry/useTelemetrySource";

type PositionState = {
  callsign: string;
  manualLat: string;
  manualLon: string;
};

export default function RecoveryPanel() {
  const telemetry = useTelemetrySource("lora");
  const [left, setLeft] = useState<PositionState>({ callsign: "", manualLat: "", manualLon: "" });
  const [right, setRight] = useState<PositionState>({ callsign: "", manualLat: "", manualLon: "" });

  const latestCallsign = telemetry.packet?.callsign?.trim().toLowerCase();
  const latestLat = telemetry.packet?.fields.latitudeDeg ?? null;
  const latestLon = telemetry.packet?.fields.longitudeDeg ?? null;

  const leftResolved = resolvePosition(left, latestCallsign, latestLat, latestLon);
  const rightResolved = resolvePosition(right, latestCallsign, latestLat, latestLon);
  const bearing = useMemo(() => calculateBearing(leftResolved.lat, leftResolved.lon, rightResolved.lat, rightResolved.lon), [leftResolved, rightResolved]);

  return (
    <div className="grid gap-1 grid-cols-[280px_minmax(0,1fr)_minmax(0,1fr)_180px]">
      <TelemetryStatus
        source="lora"
        status={telemetry.status}
        packet={telemetry.packet}
        expectedPacketsPerSecond={telemetry.snapshot?.config.expectedPacketsPerSecond ?? 10}
        staleTimeoutMs={telemetry.snapshot?.config.staleTimeoutMs ?? 3000}
      />
      <RecoveryCard title="Left Callsign" state={left} onChange={setLeft} resolved={leftResolved} />
      <RecoveryCard title="Right Callsign" state={right} onChange={setRight} resolved={rightResolved} />
      <div className="rounded-[20px] border border-white/10 bg-black/20 p-2 flex flex-col items-center justify-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">Bearing</p>
        <div className="mx-auto mt-1 flex h-32 w-32 items-center justify-center rounded-full border border-cyan-300/35 bg-[radial-gradient(circle,rgba(56,189,248,0.12),rgba(2,6,23,0.95))]">
          <div className="text-center">
            <p className="font-mono text-2xl font-semibold text-white">{bearing === null ? "--" : `${bearing.toFixed(0)}°`}</p>
            <p className="mt-0.5 text-[8px] text-slate-300">bearing</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecoveryCard({
  title,
  state,
  onChange,
  resolved,
}: {
  title: string;
  state: PositionState;
  onChange: (value: PositionState) => void;
  resolved: { lat: number | null; lon: number | null; source: string };
}) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-black/20 p-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">{title}</p>
      <div className="mt-1 space-y-1">
        <input
          value={state.callsign}
          onChange={(event) => onChange({ ...state, callsign: event.target.value })}
          placeholder="Callsign"
          className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-1.5 py-1 text-slate-100 outline-none focus:border-cyan-300/40 text-[10px]"
        />
        <input
          value={state.manualLat}
          onChange={(event) => onChange({ ...state, manualLat: event.target.value })}
          placeholder="Lat"
          className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-1.5 py-1 text-slate-100 outline-none focus:border-cyan-300/40 text-[10px]"
        />
        <input
          value={state.manualLon}
          onChange={(event) => onChange({ ...state, manualLon: event.target.value })}
          placeholder="Lon"
          className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-1.5 py-1 text-slate-100 outline-none focus:border-cyan-300/40 text-[10px]"
        />
      </div>
      <dl className="mt-1 text-[9px] text-slate-200 space-y-0.5">
        <div>
          <dt className="text-slate-400">Lat</dt>
          <dd className="text-[8px]">{resolved.lat === null ? "--" : resolved.lat.toFixed(4)}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Lon</dt>
          <dd className="text-[8px]">{resolved.lon === null ? "--" : resolved.lon.toFixed(4)}</dd>
        </div>
      </dl>
      <p className="mt-0.5 text-[8px] text-slate-400">{resolved.source}</p>
    </div>
  );
}

function resolvePosition(state: PositionState, latestCallsign: string | undefined, latestLat: number | null, latestLon: number | null) {
  const match = state.callsign.trim().toLowerCase();
  if (match && latestCallsign && match === latestCallsign && latestLat !== null && latestLon !== null) {
    return { lat: latestLat, lon: latestLon, source: "radio" };
  }
  const lat = parseCoordinate(state.manualLat);
  const lon = parseCoordinate(state.manualLon);
  if (lat !== null && lon !== null) {
    return { lat, lon, source: "manual" };
  }
  return { lat: null, lon: null, source: "unknown" };
}

function parseCoordinate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function calculateBearing(leftLat: number | null, leftLon: number | null, rightLat: number | null, rightLon: number | null) {
  if ([leftLat, leftLon, rightLat, rightLon].some((value) => value === null)) {
    return null;
  }
  const lat1 = ((leftLat as number) * Math.PI) / 180;
  const lat2 = ((rightLat as number) * Math.PI) / 180;
  const deltaLon = (((rightLon as number) - (leftLon as number)) * Math.PI) / 180;
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}
