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
    <div className="responsive-panel-grid responsive-panel-grid-raw">
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
            Telemetry Data
          </p>
          <button
            onClick={() => void telemetry.refreshSnapshot()}
            className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.25em] text-slate-200 hover:bg-white/10"
          >
            Refresh
          </button>
        </div>

        <div className="mt-1 grid grid-cols-3 gap-1 text-[8px]">
          <div>
            <p className="font-semibold text-cyan-300 mb-1">Flight</p>
            <DataBox label="Alt" value={formatValue(telemetry.packet?.fields.altitudeAglFt, "ft")} />
            <DataBox label="Mode" value={telemetry.packet?.fields.flightMode ?? "--"} />
            <DataBox label="Apogee" value={formatValue(telemetry.packet?.fields.expectedApogeeFt, "ft")} />
            <DataBox label="Barometer" value={formatValue(telemetry.packet?.fields.barometricPressurePa, "Pa")} />
          </div>

          <div>
            <p className="font-semibold text-cyan-300 mb-1">Accel</p>
            <DataBox label="Total" value={formatValue(telemetry.packet?.fields.accelTotalG, "g", 2)} />
            <DataBox label="X" value={formatValue(telemetry.packet?.fields.accelXG, "g", 2)} />
            <DataBox label="Y" value={formatValue(telemetry.packet?.fields.accelYG, "g", 2)} />
            <DataBox label="Z" value={formatValue(telemetry.packet?.fields.accelZG, "g", 2)} />

            <p className="font-semibold text-cyan-300 mb-1 mt-2">Velocity</p>
            <DataBox label="Speed" value={formatValue(telemetry.packet?.fields.speedMps, "m/s", 1)} />
            <DataBox label="X" value={formatValue(telemetry.packet?.fields.velocityXMps, "m/s", 1)} />
            <DataBox label="Y" value={formatValue(telemetry.packet?.fields.velocityYMps, "m/s", 1)} />
            <DataBox label="Z" value={formatValue(telemetry.packet?.fields.velocityZMps, "m/s", 1)} />
          </div>

          <div>
            <p className="font-semibold text-cyan-300 mb-1">Position</p>
            <DataBox label="X" value={formatValue(telemetry.packet?.fields.positionXM, "m")} />
            <DataBox label="Y" value={formatValue(telemetry.packet?.fields.positionYM, "m")} />
            <DataBox label="Z" value={formatValue(telemetry.packet?.fields.positionZM, "m")} />

            <p className="font-semibold text-cyan-300 mb-1 mt-2">Gyro (°/s)</p>
            <DataBox label="X" value={formatValue(telemetry.packet?.fields.gyroXDps, "", 1)} />
            <DataBox label="Y" value={formatValue(telemetry.packet?.fields.gyroYDps, "", 1)} />
            <DataBox label="Z" value={formatValue(telemetry.packet?.fields.gyroZDps, "", 1)} />

            <p className="font-semibold text-cyan-300 mb-1 mt-2">Magnetometer (mT)</p>
            <DataBox label="X" value={formatValue(telemetry.packet?.fields.magXMt, "", 2)} />
            <DataBox label="Y" value={formatValue(telemetry.packet?.fields.magYMt, "", 2)} />
            <DataBox label="Z" value={formatValue(telemetry.packet?.fields.magZMt, "", 2)} />

            <p className="font-semibold text-cyan-300 mb-1 mt-2">GPS</p>
            <DataBox label="Lat" value={formatValue(telemetry.packet?.fields.latitudeDeg, "°", 4)} />
            <DataBox label="Lon" value={formatValue(telemetry.packet?.fields.longitudeDeg, "°", 4)} />
            <DataBox label="Sats" value={telemetry.packet?.fields.gpsSatelliteCount != null ? String(telemetry.packet.fields.gpsSatelliteCount) : "--"} />
            <DataBox label="Seq" value={String(telemetry.packet?.sequence ?? "--")} />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white/8 bg-black/25 p-2 max-h-[200px] overflow-hidden flex flex-col">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">
          Raw Packet JSON
        </p>
        <pre className="mt-1 overflow-auto flex-1 rounded-lg border border-white/8 bg-black/35 p-1.5 text-[7px] text-slate-200">
          {telemetry.packet
            ? JSON.stringify(telemetry.packet.raw, null, 2)
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

