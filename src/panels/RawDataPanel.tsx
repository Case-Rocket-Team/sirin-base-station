import { useEffect, useState } from "react";
import TelemetryStatus from "./TelemetryStatus";
import { useTelemetrySource } from "../telemetry/useTelemetrySource";
import type { RecordingFormat, TelemetrySource } from "../telemetry/types";

type Props = {
  selectedSource: TelemetrySource;
};

export default function RawDataPanel({ selectedSource }: Props) {
  const telemetry = useTelemetrySource(selectedSource);
  const [filename, setFilename] = useState(`${selectedSource}-capture`);
  const [format, setFormat] = useState<RecordingFormat>("jsonl");
  const [commandError, setCommandError] = useState<string | null>(null);

  useEffect(() => {
    setFilename(`${selectedSource}-capture`);
  }, [selectedSource]);

  useEffect(() => {
    if (telemetry.snapshot?.config.defaultRecordingFormat) {
      setFormat(telemetry.snapshot.config.defaultRecordingFormat);
    }
  }, [telemetry.snapshot?.config.defaultRecordingFormat]);

  const handleToggleRecording = async () => {
    setCommandError(null);
    try {
      if (telemetry.recordingStatus?.active) {
        await telemetry.stopRecording();
      } else {
        await telemetry.startRecording({
          source: selectedSource,
          filename,
          format,
        });
      }
      await telemetry.refreshSnapshot();
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="grid gap-1 grid-cols-[280px_minmax(0,1fr)_220px_220px]">
      <TelemetryStatus
        source={selectedSource}
        status={telemetry.status}
        packet={telemetry.packet}
        expectedPacketsPerSecond={telemetry.snapshot?.config.expectedPacketsPerSecond ?? 10}
        staleTimeoutMs={telemetry.snapshot?.config.staleTimeoutMs ?? 3000}
      />

      <div className="rounded-lg border border-white/8 bg-black/25 p-2">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">
            Validated Packet
          </p>
          <button
            onClick={() => void telemetry.refreshSnapshot()}
            className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.25em] text-slate-200 hover:bg-white/10"
          >
            Refresh
          </button>
        </div>

        <pre className="mt-1 h-[140px] overflow-auto rounded-lg border border-white/8 bg-black/35 p-1.5 text-[9px] text-slate-200">
          {telemetry.packet
            ? JSON.stringify(telemetry.packet, null, 2)
            : "No packet."}
        </pre>
      </div>

      <div className="rounded-lg border border-white/8 bg-black/25 p-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">
          Recording
        </p>

        <label className="mt-1 block text-[10px] text-slate-300">
          <span className="mb-0.5 block font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400">
            File
          </span>
          <input
            value={filename}
            onChange={(event) => setFilename(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-1.5 py-1 text-slate-100 outline-none transition focus:border-cyan-300/40 text-[10px]"
          />
        </label>

        <label className="mt-1 block text-[10px] text-slate-300">
          <span className="mb-0.5 block font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400">
            Format
          </span>
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value as RecordingFormat)}
            className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-1.5 py-1 text-slate-100 outline-none transition focus:border-cyan-300/40 text-[10px]"
          >
            <option value="jsonl">JSONL</option>
            <option value="csv">CSV</option>
          </select>
        </label>

        <button
          onClick={() => void handleToggleRecording()}
          className={`mt-1 w-full rounded-lg px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.25em] transition ${
            telemetry.recordingStatus?.active
              ? "bg-rose-500/90 text-white hover:bg-rose-500"
              : "bg-emerald-500/90 text-slate-950 hover:bg-emerald-400"
          }`}
        >
          {telemetry.recordingStatus?.active ? "Stop" : "Start"}
        </button>

        {(commandError || telemetry.recordingStatus?.lastError) && (
          <p className="mt-1 text-[9px] text-rose-300 line-clamp-1">
            {commandError ?? telemetry.recordingStatus?.lastError}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-white/8 bg-black/25 p-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">
          Status
        </p>
        <dl className="mt-1 text-[9px] text-slate-200 space-y-0.5">
          <InfoRow label="Active" value={telemetry.recordingStatus?.active ? "Yes" : "No"} />
          <InfoRow label="Source" value={telemetry.recordingStatus?.source ?? "--"} />
          <InfoRow label="Format" value={telemetry.recordingStatus?.format ?? "--"} />
          <InfoRow label="Packets" value={String(telemetry.recordingStatus?.packetsWritten ?? 0)} />
        </dl>
        <p className="mt-1 text-[8px] text-slate-400 overflow-hidden text-ellipsis">
          {telemetry.recordingStatus?.path?.split(/[/\\]/).pop() ?? "None"}
        </p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-400">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

