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
    <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      <TelemetryStatus
        source="lora"
        status={telemetry.status}
        packet={telemetry.packet}
        expectedPacketsPerSecond={telemetry.snapshot?.config.expectedPacketsPerSecond ?? 10}
        staleTimeoutMs={telemetry.snapshot?.config.staleTimeoutMs ?? 3000}
      />
      <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-4 backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-2">
          <RecoveryCard title="Left Callsign" state={left} onChange={setLeft} resolved={leftResolved} />
          <RecoveryCard title="Right Callsign" state={right} onChange={setRight} resolved={rightResolved} />
        </div>
        <div className="mt-4 rounded-[28px] border border-white/10 bg-black/20 p-6 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-200/75">Bearing Display</p>
          <div className="mx-auto mt-5 flex h-56 w-56 items-center justify-center rounded-full border border-cyan-300/35 bg-[radial-gradient(circle,_rgba(56,189,248,0.12),_rgba(2,6,23,0.95))]">
            <div className="text-center">
              <p className="font-mono text-5xl font-semibold text-white">{bearing === null ? "--" : `${bearing.toFixed(0)}°`}</p>
              <p className="mt-3 text-sm text-slate-300">True bearing from left to right</p>
            </div>
          </div>
        </div>
      </section>
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
    <div className="rounded-[28px] border border-white/10 bg-black/20 p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-200/75">{title}</p>
      <div className="mt-4 grid gap-3">
        <input
          value={state.callsign}
          onChange={(event) => onChange({ ...state, callsign: event.target.value })}
          placeholder="Callsign"
          className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-slate-100 outline-none focus:border-cyan-300/40"
        />
        <input
          value={state.manualLat}
          onChange={(event) => onChange({ ...state, manualLat: event.target.value })}
          placeholder="Manual latitude"
          className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-slate-100 outline-none focus:border-cyan-300/40"
        />
        <input
          value={state.manualLon}
          onChange={(event) => onChange({ ...state, manualLon: event.target.value })}
          placeholder="Manual longitude"
          className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-slate-100 outline-none focus:border-cyan-300/40"
        />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-200">
        <div>
          <dt className="text-slate-400">Latitude</dt>
          <dd>{resolved.lat === null ? "--" : resolved.lat.toFixed(5)}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Longitude</dt>
          <dd>{resolved.lon === null ? "--" : resolved.lon.toFixed(5)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-slate-400">Source: {resolved.source}</p>
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
