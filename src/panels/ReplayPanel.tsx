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
    <div className="flex flex-col gap-1">
      <section className="rounded-[20px] border border-white/10 bg-slate-950/55 p-2 backdrop-blur">
        <div className="grid gap-1 grid-cols-[minmax(0,1fr)_70px_70px_70px_70px_70px_70px]">
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

      <section className="grid gap-1 grid-cols-[minmax(0,1fr)_200px]">
        <div className="rounded-[20px] border border-white/10 bg-slate-950/55 p-2 backdrop-blur">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">Replay Packet</p>
          <pre className="mt-1 h-[130px] overflow-auto rounded-lg border border-white/8 bg-black/35 p-1.5 text-[9px] text-slate-200">
            {packet ? JSON.stringify(packet, null, 2) : "No packet."}
          </pre>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-slate-950/55 p-2 backdrop-blur">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">Status</p>
          <dl className="mt-1 text-[9px] text-slate-200 space-y-0.5">
            <Metric label="File" value={(telemetry.replayStatus?.sourcePath ?? "--").split(/[/\\]/).pop() ?? "--"} />
            <Metric label="Ts" value={telemetry.replayStatus?.currentTimestampMs ? String(telemetry.replayStatus.currentTimestampMs).slice(0, 8) : "--"} />
            <Metric label="Mode" value={packet?.fields.flightMode ?? "--"} />
            <Metric label="Alt" value={packet?.fields.altitudeAglFt !== null && packet?.fields.altitudeAglFt !== undefined ? `${Math.round(packet.fields.altitudeAglFt)}` : "--"} />
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
