import { useState } from "react";
import { useTelemetrySource } from "../telemetry/useTelemetrySource";
import TelemetryBar from "./TelemetryBar";

export default function ReplayPanel() {
  const telemetry = useTelemetrySource("lora");
  const [path, setPath] = useState("");
  const [speed, setSpeed] = useState("1");
  const [error, setError] = useState<string | null>(null);
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
    <div className="flex flex-col gap-4">
      <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-4 backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_120px_120px_120px_120px_120px_120px]">
          <input
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="C:\\path\\to\\recording.jsonl"
            className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-slate-100 outline-none focus:border-cyan-300/40"
          />
          <input
            value={speed}
            onChange={(event) => setSpeed(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-slate-100 outline-none focus:border-cyan-300/40"
          />
          <button onClick={() => void handleLoad()} className="rounded-xl bg-cyan-300 px-4 py-3 font-mono text-xs uppercase tracking-[0.25em] text-slate-950">
            Load
          </button>
          <button onClick={() => void handlePlay()} className="rounded-xl bg-emerald-400/90 px-4 py-3 font-mono text-xs uppercase tracking-[0.25em] text-slate-950">
            Play
          </button>
          <button onClick={() => void handlePause()} className="rounded-xl bg-amber-300/90 px-4 py-3 font-mono text-xs uppercase tracking-[0.25em] text-slate-950">
            Pause
          </button>
          <button onClick={() => void handleStep()} className="rounded-xl bg-white/10 px-4 py-3 font-mono text-xs uppercase tracking-[0.25em] text-white">
            Step
          </button>
          <button onClick={() => void handleRestart()} className="rounded-xl bg-rose-500/80 px-4 py-3 font-mono text-xs uppercase tracking-[0.25em] text-white">
            Restart
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-300">
          <span>Loaded: {telemetry.replayStatus?.loaded ? "Yes" : "No"}</span>
          <span>Packets: {telemetry.replayStatus?.packetCount ?? 0}</span>
          <span>Index: {telemetry.replayStatus?.currentIndex ?? 0}</span>
          <span>Speed: {telemetry.replayStatus?.speed ?? 1}x</span>
        </div>
        {(error || telemetry.replayStatus?.lastError) && <p className="mt-3 text-sm text-rose-300">{error ?? telemetry.replayStatus?.lastError}</p>}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-4 backdrop-blur">
          <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-200/75">Replay Packet</p>
          <pre className="mt-4 max-h-[520px] overflow-auto rounded-2xl border border-white/8 bg-black/35 p-4 text-xs text-slate-200">
            {packet ? JSON.stringify(packet, null, 2) : "No replay packet emitted yet."}
          </pre>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-4 backdrop-blur">
          <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-200/75">Replay Status</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-200">
            <Metric label="File" value={telemetry.replayStatus?.sourcePath ?? "--"} />
            <Metric label="Timestamp" value={telemetry.replayStatus?.currentTimestampMs ? String(telemetry.replayStatus.currentTimestampMs) : "--"} />
            <Metric label="Mode" value={packet?.fields.flightMode ?? "--"} />
            <Metric label="Altitude" value={packet?.fields.altitudeAglFt !== null && packet?.fields.altitudeAglFt !== undefined ? `${Math.round(packet.fields.altitudeAglFt)} ft` : "--"} />
          </dl>
        </div>
      </section>

      <TelemetryBar
        altitudeFt={packet?.fields.altitudeAglFt ?? null}
        apogeeFt={packet?.fields.expectedApogeeFt ?? null}
        flightMode={packet?.fields.flightMode ?? null}
        speedMps={packet?.fields.speedMps ?? null}
        accelTotalG={packet?.fields.accelTotalG ?? null}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-400">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
