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
    <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      <TelemetryStatus
        source={selectedSource}
        status={telemetry.status}
        packet={telemetry.packet}
        expectedPacketsPerSecond={telemetry.snapshot?.config.expectedPacketsPerSecond ?? 10}
        staleTimeoutMs={telemetry.snapshot?.config.staleTimeoutMs ?? 3000}
      />

      <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-4 backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-white/8 bg-black/25 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-200/75">
                  Validated Packet
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Backend-normalized payload for the selected source.
                </p>
              </div>
              <button
                onClick={() => void telemetry.refreshSnapshot()}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mono text-xs uppercase tracking-[0.25em] text-slate-200 hover:bg-white/10"
              >
                Refresh
              </button>
            </div>

            <pre className="mt-4 max-h-[620px] overflow-auto rounded-2xl border border-white/8 bg-black/35 p-4 text-xs text-slate-200">
              {telemetry.packet
                ? JSON.stringify(telemetry.packet, null, 2)
                : "No validated packet received yet."}
            </pre>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/8 bg-black/25 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-200/75">
                Recording Controls
              </p>

              <label className="mt-4 block text-sm text-slate-300">
                <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  Filename
                </span>
                <input
                  value={filename}
                  onChange={(event) => setFilename(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-slate-100 outline-none transition focus:border-cyan-300/40"
                />
              </label>

              <label className="mt-4 block text-sm text-slate-300">
                <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  Format
                </span>
                <select
                  value={format}
                  onChange={(event) => setFormat(event.target.value as RecordingFormat)}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-slate-100 outline-none transition focus:border-cyan-300/40"
                >
                  <option value="jsonl">JSONL</option>
                  <option value="csv">CSV</option>
                </select>
              </label>

              <button
                onClick={() => void handleToggleRecording()}
                className={`mt-5 w-full rounded-xl px-4 py-3 font-mono text-xs uppercase tracking-[0.25em] transition ${
                  telemetry.recordingStatus?.active
                    ? "bg-rose-500/90 text-white hover:bg-rose-500"
                    : "bg-emerald-500/90 text-slate-950 hover:bg-emerald-400"
                }`}
              >
                {telemetry.recordingStatus?.active ? "Stop Recording" : "Start Recording"}
              </button>

              {(commandError || telemetry.recordingStatus?.lastError) && (
                <p className="mt-3 text-sm text-rose-300">
                  {commandError ?? telemetry.recordingStatus?.lastError}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-white/8 bg-black/25 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-200/75">
                Recording Status
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-200">
                <InfoRow label="Active" value={telemetry.recordingStatus?.active ? "Yes" : "No"} />
                <InfoRow label="Source" value={telemetry.recordingStatus?.source ?? "--"} />
                <InfoRow label="Format" value={telemetry.recordingStatus?.format ?? "--"} />
                <InfoRow label="Packets" value={String(telemetry.recordingStatus?.packetsWritten ?? 0)} />
              </dl>
              <p className="mt-4 text-xs text-slate-400">
                {telemetry.recordingStatus?.path ?? "No recording file selected."}
              </p>
            </div>

            <div className="rounded-2xl border border-white/8 bg-black/25 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-200/75">
                Raw Payload
              </p>
              <pre className="mt-3 max-h-[280px] overflow-auto rounded-2xl border border-white/8 bg-black/35 p-3 text-[11px] text-slate-200">
                {telemetry.packet
                  ? JSON.stringify(telemetry.packet.raw, null, 2)
                  : "No raw payload received yet."}
              </pre>
            </div>
          </div>
        </div>
      </section>
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

