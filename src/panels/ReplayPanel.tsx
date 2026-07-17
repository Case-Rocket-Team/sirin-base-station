import { useState } from "react";
import { useTelemetrySource } from "../telemetry/useTelemetrySource";
import AltitudeBar from "./AltitudeBar";
import RocketOrientation from "./RocketOrientation";
import TelemetryBar from "./TelemetryBar";
import TimelineBar from "./TimelineBar";
import ThreeDPosition from "./3DPosition";

type DisplayMode = "overview" | "detailed";

export default function ReplayPanel() {
  const telemetry = useTelemetrySource("lora");
  const [path, setPath] = useState("");
  const [speed, setSpeed] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("overview");
  const packet = telemetry.replayPacket;

  const handleLoad = async () => {
    setError(null);
    try {
      await telemetry.loadReplayFile(path);
      await telemetry.refreshSnapshot();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  };

  const handlePlay = async () => {
    setError(null);
    try {
      await telemetry.startReplay(Number(speed));
      await telemetry.refreshSnapshot();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  };

  const handlePause = async () => {
    setError(null);
    try {
      await telemetry.pauseReplay();
      await telemetry.refreshSnapshot();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  };

  const handleStep = async () => {
    setError(null);
    try {
      await telemetry.stepReplay();
      await telemetry.refreshSnapshot();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  };

  const handleRestart = async () => {
    setError(null);
    try {
      await telemetry.stopReplay();
      await telemetry.refreshSnapshot();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <section className="rounded-[20px] border border-white/10 bg-slate-950/55 p-2 backdrop-blur">
        <div className="responsive-replay-controls">
          <input
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="Path to recording.jsonl"
            className="rounded-lg border border-white/10 bg-slate-900/80 px-1.5 py-1 text-slate-100 outline-none focus:border-cyan-300/40 text-[10px]"
          />
          <input
            value={speed}
            onChange={(event) => setSpeed(event.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900/80 px-1.5 py-1 text-slate-100 outline-none focus:border-cyan-300/40 text-[10px]"
          />
          <button onClick={() => void handleLoad()} className="rounded-lg bg-cyan-300 px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-slate-950">
            Load
          </button>
          <button onClick={() => void handlePlay()} className="rounded-lg bg-emerald-400/90 px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-slate-950">
            Play
          </button>
          <button onClick={() => void handlePause()} className="rounded-lg bg-amber-300/90 px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-slate-950">
            Pause
          </button>
          <button onClick={() => void handleStep()} className="rounded-lg bg-white/10 px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-white">
            Step
          </button>
          <button onClick={() => void handleRestart()} className="rounded-lg bg-rose-500/80 px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-white">
            Restart
          </button>
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-[9px] text-slate-300">
          <span>L: {telemetry.replayStatus?.loaded ? "Y" : "N"}</span>
          <span>P: {telemetry.replayStatus?.packetCount ?? 0}</span>
          <span>I: {telemetry.replayStatus?.currentIndex ?? 0}</span>
          <span>S: {telemetry.replayStatus?.speed ?? 1}x</span>
        </div>
        {(error || telemetry.replayStatus?.lastError) && <p className="mt-0.5 text-[9px] text-rose-300 line-clamp-1">{error ?? telemetry.replayStatus?.lastError}</p>}
      </section>

      <div className="flex gap-2 mb-1">
        <button
          onClick={() => setDisplayMode("overview")}
          className={`px-3 py-1 rounded-lg font-mono text-[9px] uppercase tracking-[0.25em] transition ${
            displayMode === "overview"
              ? "bg-cyan-500/90 text-white"
              : "bg-white/10 text-slate-300 hover:bg-white/20"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setDisplayMode("detailed")}
          className={`px-3 py-1 rounded-lg font-mono text-[9px] uppercase tracking-[0.25em] transition ${
            displayMode === "detailed"
              ? "bg-cyan-500/90 text-white"
              : "bg-white/10 text-slate-300 hover:bg-white/20"
          }`}
        >
          Detailed
        </button>
      </div>

      {displayMode === "overview" ? (
        <div className="dashboard-shell flex-1">
          <div className="dashboard-card dashboard-altitude">
            <AltitudeBar
              altitudeFt={packet?.fields.altitudeAglFt ?? null}
              minFt={telemetry.snapshot?.config.altitudeMinFt ?? 0}
              maxFt={telemetry.snapshot?.config.altitudeMaxFt ?? 40000}
              targetFt={telemetry.snapshot?.config.targetAltitudeFt ?? 30000}
            />
          </div>

          <div className="dashboard-card dashboard-orientation">
            <div className="orientation-frame">
              <RocketOrientation quatW={packet?.fields.quatW ?? null} quatX={packet?.fields.quatX ?? null} quatY={packet?.fields.quatY ?? null} quatZ={packet?.fields.quatZ ?? null} />
            </div>
          </div>

          <div className="dashboard-card dashboard-apogee p-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">Apogee Predictor</p>
            <p className="mt-2 font-mono text-2xl font-semibold text-white">{packet?.fields.expectedApogeeFt == null ? "--" : Math.round(packet.fields.expectedApogeeFt).toLocaleString()}<span className="ml-1 text-xs text-slate-400">ft</span></p>
            <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-slate-400">Expected maximum altitude</p>
          </div>

          <div className="dashboard-card dashboard-position">
            <p className="p-2 font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">Position Trace</p>
            <div className="h-[calc(100%-2rem)] min-h-[12rem] overflow-hidden">
              <ThreeDPosition x={packet?.fields.positionXM ?? null} y={packet?.fields.positionYM ?? null} z={packet?.fields.positionZM ?? null} />
            </div>
          </div>

          <div className="dashboard-card dashboard-telemetry">
            <TimelineBar timeline={telemetry.timelineState} />
            <TelemetryBar altitudeFt={packet?.fields.altitudeAglFt ?? null} apogeeFt={packet?.fields.expectedApogeeFt ?? null} flightMode={packet?.fields.flightMode ?? null} speedMps={packet?.fields.speedMps ?? null} accelTotalG={packet?.fields.accelTotalG ?? null} />
          </div>
        </div>
      ) : (
        <section className="flex-1 overflow-auto">
          <div className="rounded-[20px] border border-white/10 bg-slate-950/55 p-2 backdrop-blur">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">Telemetry Data</p>

            <div className="mt-1 grid grid-cols-3 gap-1 text-[8px]">
              <div>
                <p className="font-semibold text-cyan-300 mb-1">Flight</p>
                <DataBox label="Alt" value={formatValue(packet?.fields.altitudeAglFt, "ft")} />
                <DataBox label="Mode" value={packet?.fields.flightMode ?? "--"} />
                <DataBox label="Apogee" value={formatValue(packet?.fields.expectedApogeeFt, "ft")} />
                <DataBox label="Barometer" value={formatValue(packet?.fields.barometricPressurePa, "Pa")} />

                <p className="font-semibold text-cyan-300 mb-1 mt-2">GPS</p>
                <DataBox label="Lat" value={formatValue(packet?.fields.latitudeDeg, "°", 4)} />
                <DataBox label="Lon" value={formatValue(packet?.fields.longitudeDeg, "°", 4)} />
                <DataBox label="Sats" value={packet?.fields.gpsSatelliteCount != null ? String(packet.fields.gpsSatelliteCount) : "--"} />
                <DataBox label="Seq" value={String(packet?.sequence ?? "--")} />
              </div>

              <div>
                <p className="font-semibold text-cyan-300 mb-1">Accel</p>
                <DataBox label="Total" value={formatValue(packet?.fields.accelTotalG, "g", 2)} />
                <DataBox label="X" value={formatValue(packet?.fields.accelXG, "g", 2)} />
                <DataBox label="Y" value={formatValue(packet?.fields.accelYG, "g", 2)} />
                <DataBox label="Z" value={formatValue(packet?.fields.accelZG, "g", 2)} />

                <p className="font-semibold text-cyan-300 mb-1 mt-2">Velocity</p>
                <DataBox label="Speed" value={formatValue(packet?.fields.speedMps, "m/s", 1)} />
                <DataBox label="X" value={formatValue(packet?.fields.velocityXMps, "m/s", 1)} />
                <DataBox label="Y" value={formatValue(packet?.fields.velocityYMps, "m/s", 1)} />
                <DataBox label="Z" value={formatValue(packet?.fields.velocityZMps, "m/s", 1)} />
              </div>

              <div>
                <p className="font-semibold text-cyan-300 mb-1">Position</p>
                <DataBox label="X" value={formatValue(packet?.fields.positionXM, "m")} />
                <DataBox label="Y" value={formatValue(packet?.fields.positionYM, "m")} />
                <DataBox label="Z" value={formatValue(packet?.fields.positionZM, "m")} />

                <p className="font-semibold text-cyan-300 mb-1 mt-2">Gyro (°/s)</p>
                <DataBox label="X" value={formatValue(packet?.fields.gyroXDps, "", 1)} />
                <DataBox label="Y" value={formatValue(packet?.fields.gyroYDps, "", 1)} />
                <DataBox label="Z" value={formatValue(packet?.fields.gyroZDps, "", 1)} />

                <p className="font-semibold text-cyan-300 mb-1 mt-2">Magnetometer (mT)</p>
                <DataBox label="X" value={formatValue(packet?.fields.magXMt, "", 2)} />
                <DataBox label="Y" value={formatValue(packet?.fields.magYMt, "", 2)} />
                <DataBox label="Z" value={formatValue(packet?.fields.magZMt, "", 2)} />
              </div>
            </div>
          </div>

          <div className="mt-1 rounded-[20px] border border-white/10 bg-slate-950/55 p-2 backdrop-blur max-h-[200px] overflow-hidden flex flex-col">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">
              Raw Packet JSON
            </p>
            <pre className="mt-1 overflow-auto flex-1 rounded-lg border border-white/8 bg-black/35 p-1.5 text-[7px] text-slate-200">
              {packet ? JSON.stringify(packet.raw, null, 2) : "No packet."}
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}

function DataBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/35 p-1.5">
      <p className="text-[8px] uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-0.5 font-mono text-[9px] text-slate-200">{value}</p>
    </div>
  );
}

function formatValue(value: number | null | undefined, unit: string, decimals: number = 0): string {
  if (typeof value !== "number") return "--";
  if (decimals > 0) {
    return `${value.toFixed(decimals)} ${unit}`;
  }
  return `${Math.round(value)} ${unit}`;
}
