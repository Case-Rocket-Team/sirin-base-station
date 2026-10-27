import { useEffect, useState } from "react";
import { LineChart } from "@mui/x-charts/LineChart";
import TelemetryStatus from "./TelemetryStatus";
import { useTelemetrySource } from "../telemetry/useTelemetrySource";
import type { RecordingFormat, TelemetrySource } from "../telemetry/types";

type Props = {
  selectedSource: TelemetrySource;
};

type HistoryPoint = {
  id: string;
  time: string;
  accelTotal: number;
  speed: number;
  altitude: number;
};

export default function RawDataPanel({ selectedSource }: Props) {
  const telemetry = useTelemetrySource(selectedSource);
  const [filename, setFilename] = useState(`${selectedSource}-capture`);
  const [format, setFormat] = useState<RecordingFormat>("jsonl");
  const [commandError, setCommandError] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryPoint[]>([]);

  // Reset history when telemetry source changes
  useEffect(() => {
    setFilename(`${selectedSource}-capture`);
    setHistory([]);
  }, [selectedSource]);

  // Capture real-time telemetry packets for Accel, Speed, and Altitude
  useEffect(() => {
    if (!telemetry.packet) return;

    const packetTime = telemetry.packet.timestamp ? new Date(telemetry.packet.timestamp) : new Date();
    const formattedTime = `${packetTime.toLocaleTimeString([], {
      minute: "2-digit",
      second: "2-digit",
    })}.${packetTime.getSeconds() < 10 ? "0" : ""}${packetTime.getMilliseconds().toString().padStart(3, "0")}`;

    const fields = telemetry.packet.fields as Record<string, unknown> | undefined;

    setHistory((prev) => {
      const lastPoint = prev[prev.length - 1];

      // Accel: fallback to previous point's value if missing in this packet
      const rawAccel = fields?.accelTotalG ?? fields?.accelTotal ?? fields?.accel_total;
      const parsedAccel =
        typeof rawAccel === "number"
          ? rawAccel
          : rawAccel != null && !isNaN(parseFloat(String(rawAccel)))
          ? parseFloat(String(rawAccel))
          : lastPoint?.accelTotal ?? 0;

      // Speed: fallback to previous point's value if missing
      const rawSpeed = fields?.speedMps ?? fields?.speed_mps ?? fields?.speed;
      const parsedSpeed =
        typeof rawSpeed === "number"
          ? rawSpeed
          : rawSpeed != null && !isNaN(parseFloat(String(rawSpeed)))
          ? parseFloat(String(rawSpeed))
          : lastPoint?.speed ?? 0;

      // Altitude: fallback to previous point's value if missing
      const rawAlt = fields?.altitudeAglFt ?? fields?.altitude_agl_ft ?? fields?.altitude;
      const parsedAlt =
        typeof rawAlt === "number"
          ? rawAlt
          : rawAlt != null && !isNaN(parseFloat(String(rawAlt)))
          ? parseFloat(String(rawAlt))
          : lastPoint?.altitude ?? 0;

      const newPoint: HistoryPoint = {
        id: `${formattedTime}-${telemetry.packet?.sequence ?? Math.random()}`,
        time: formattedTime,
        accelTotal: parsedAccel,
        speed: parsedSpeed,
        altitude: parsedAlt,
      };

      // Keep strict rolling window of 50 points
      return [...prev, newPoint].slice(-50);
    });
  }, [telemetry.packet]);

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

  // Generate unique numeric indices [0, 1, 2, ..., N-1] for X axis positioning
  const xAxisIndices = history.length ? history.map((_, i) => i) : [0];

  const accelTotalData = history.length ? history.map((d) => d.accelTotal) : [0];
  const speedData = history.length ? history.map((d) => d.speed) : [0];
  const altitudeData = history.length ? history.map((d) => d.altitude) : [0];

  // Dynamic Y-axis limits for Acceleration
  const minY = history.length ? Math.min(...accelTotalData) : 0;
  const maxY = history.length ? Math.max(...accelTotalData) : 1.2;
  const padding = Math.max((maxY - minY) * 0.25, 0.1);

  // Dynamic Y-axis limits for Velocity
  const minSpeedY = history.length ? Math.min(...speedData) : 0;
  const maxSpeedY = history.length ? Math.max(...speedData) : 10;
  const speedPadding = Math.max((maxSpeedY - minSpeedY) * 0.25, 1);

  // Dynamic Y-axis limits for Altitude
  const minAltY = history.length ? Math.min(...altitudeData) : 0;
  const maxAltY = history.length ? Math.max(...altitudeData) : 100;
  const altPadding = Math.max((maxAltY - minAltY) * 0.25, 5);

  // Expanded bottom margin to cleanly render X-axis labels without clipping
  const sharedMargin = { top: 35, right: 35, bottom: 60, left: 65 };
  const sharedYAxisWidth = 65;

  return (
    <div className="w-full space-y-6 p-3">
      {/* Upper Telemetry Grid */}
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

              <p className="font-semibold text-cyan-300 mb-1 mt-2">GPS</p>
              <DataBox label="Lat" value={formatValue(telemetry.packet?.fields.latitudeDeg, "°", 4)} />
              <DataBox label="Lon" value={formatValue(telemetry.packet?.fields.longitudeDeg, "°", 4)} />
              <DataBox label="Sats" value={telemetry.packet?.fields.gpsSatelliteCount != null ? String(telemetry.packet.fields.gpsSatelliteCount) : "--"} />
              <DataBox label="Seq" value={String(telemetry.packet?.sequence ?? "--")} />
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

      {/* Full Width Stacked Charts */}
      <div className="flex flex-col gap-6 w-full">
        {/* 1. Total Acceleration Chart */}
        <div className="w-full min-w-0 rounded-lg border border-white/8 bg-black/25 p-3 overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">
              Total Acceleration vs Time
            </p>
            <span className="font-mono text-[9px] text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/40">
              Live: {accelTotalData[accelTotalData.length - 1]?.toFixed(2)} g | Pts: {history.length}
            </span>
          </div>

          <div className="w-full h-[300px] relative">
            <LineChart
              height={300}
              skipAnimation
              series={[
                {
                  data: accelTotalData,
                  label: "Total Accel (g)",
                  color: "#38bdf8",
                  showMark: false,
                },
              ]}
              xAxis={[
                {
                  scaleType: "point",
                  data: xAxisIndices,
                  label: "Time",
                  valueFormatter: (idx) => history[Number(idx)]?.time.split(".")[0] ?? "",
                  tickInterval: (_, index) => index % Math.ceil((history.length || 1) / 10) === 0,
                  tickLabelStyle: { fill: "#94a3b8", fontSize: 10 },
                },
              ]}
              yAxis={[
                {
                  width: sharedYAxisWidth,
                  label: "Total Accel (g)",
                  min: minY - padding,
                  max: maxY + padding,
                  valueFormatter: (value) => `${Number(value).toFixed(2)} g`,
                  tickLabelStyle: { fill: "#fefefe", fontSize: 10 },
                },
              ]}
              margin={sharedMargin}
              grid={{ horizontal: true }}
              slotProps={{
                legend: {
                  hidden: false,
                  labelStyle: { fill: "#cbd5e1", fontSize: 10 },
                },
              }}
              sx={{
                width: "100%",
                "& .MuiChartsLegend-root, & .MuiChartsLegend-root text, & .MuiChartsLegend-root tspan, & .MuiChartsLegend-label": {
                  fill: "#f8fafc !important",
                  color: "#f8fafc !important",
                  fontSize: "10px !important",
                },
                "& .MuiChartsAxis-line, & .MuiChartsAxis-tick": {
                  stroke: "rgba(255, 255, 255, 0.4) !important",
                },
                "& .MuiChartsAxis-label": {
                  fill: "#94a3b8 !important",
                  fontSize: "10px",
                },
                "& .MuiChartsGrid-line": {
                  stroke: "rgba(255, 255, 255, 0.05)",
                  strokeDasharray: "3 3",
                },
              }}
            />
          </div>
        </div>

        {/* 2. Velocity vs Time Chart */}
        <div className="w-full min-w-0 rounded-lg border border-white/8 bg-black/25 p-3 overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">
              Velocity vs Time
            </p>
            <span className="font-mono text-[9px] text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/40">
              Live: {speedData[speedData.length - 1]?.toFixed(1)} m/s | Pts: {history.length}
            </span>
          </div>

          <div className="w-full h-[300px] relative">
            <LineChart
              height={300}
              skipAnimation
              series={[
                {
                  data: speedData,
                  label: "Speed (m/s)",
                  color: "#34d399",
                  showMark: false,
                },
              ]}
              xAxis={[
                {
                  scaleType: "point",
                  data: xAxisIndices,
                  label: "Time",
                  valueFormatter: (idx) => history[Number(idx)]?.time.split(".")[0] ?? "",
                  tickInterval: (_, index) => index % Math.ceil((history.length || 1) / 10) === 0,
                  tickLabelStyle: { fill: "#94a3b8", fontSize: 10 },
                },
              ]}
              yAxis={[
                {
                  width: sharedYAxisWidth,
                  label: "Speed (m/s)",
                  min: minSpeedY - speedPadding,
                  max: maxSpeedY + speedPadding,
                  valueFormatter: (value) => `${Number(value).toFixed(1)} m/s`,
                  tickLabelStyle: { fill: "#fefefe", fontSize: 10 },
                },
              ]}
              margin={sharedMargin}
              grid={{ horizontal: true }}
              slotProps={{
                legend: {
                  hidden: false,
                  labelStyle: { fill: "#cbd5e1", fontSize: 10 },
                },
              }}
              sx={{
                width: "100%",
                "& .MuiChartsLegend-root, & .MuiChartsLegend-root text, & .MuiChartsLegend-root tspan, & .MuiChartsLegend-label": {
                  fill: "#f8fafc !important",
                  color: "#f8fafc !important",
                  fontSize: "10px !important",
                },
                "& .MuiChartsAxis-line, & .MuiChartsAxis-tick": {
                  stroke: "rgba(255, 255, 255, 0.15)",
                },
                "& .MuiChartsAxis-label": {
                  fill: "#94a3b8",
                  fontSize: "10px",
                },
                "& .MuiChartsGrid-line": {
                  stroke: "rgba(255, 255, 255, 0.05)",
                  strokeDasharray: "3 3",
                },
              }}
            />
          </div>
        </div>

        {/* 3. Altitude vs Time Chart */}
        <div className="w-full min-w-0 rounded-lg border border-white/8 bg-black/25 p-3 overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">
              Altitude vs Time
            </p>
            <span className="font-mono text-[9px] text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/40">
              Live: {altitudeData[altitudeData.length - 1]?.toFixed(0)} ft | Pts: {history.length}
            </span>
          </div>

          <div className="w-full h-[300px] relative">
            <LineChart
              height={300}
              skipAnimation
              series={[
                {
                  data: altitudeData,
                  label: "Altitude (ft)",
                  color: "#a855f7",
                  showMark: false,
                },
              ]}
              xAxis={[
                {
                  scaleType: "point",
                  data: xAxisIndices,
                  label: "Time",
                  valueFormatter: (idx) => history[Number(idx)]?.time.split(".")[0] ?? "",
                  tickInterval: (_, index) => index % Math.ceil((history.length || 1) / 10) === 0,
                  tickLabelStyle: { fill: "#94a3b8", fontSize: 10 },
                },
              ]}
              yAxis={[
                {
                  width: sharedYAxisWidth,
                  label: "Altitude (ft)",
                  min: minAltY - altPadding,
                  max: maxAltY + altPadding,
                  valueFormatter: (value) => `${Number(value).toFixed(0)} ft`,
                  tickLabelStyle: { fill: "#fefefe", fontSize: 10 },
                },
              ]}
              margin={sharedMargin}
              grid={{ horizontal: true }}
              slotProps={{
                legend: {
                  hidden: false,
                  labelStyle: { fill: "#cbd5e1", fontSize: 10 },
                },
              }}
              sx={{
                width: "100%",
                "& .MuiChartsLegend-root, & .MuiChartsLegend-root text, & .MuiChartsLegend-root tspan, & .MuiChartsLegend-label": {
                  fill: "#f8fafc !important",
                  color: "#f8fafc !important",
                  fontSize: "10px !important",
                },
                "& .MuiChartsAxis-line, & .MuiChartsAxis-tick": {
                  stroke: "rgba(255, 255, 255, 0.4) !important",
                },
                "& .MuiChartsAxis-label": {
                  fill: "#94a3b8 !important",
                  fontSize: "10px",
                },
                "& .MuiChartsGrid-line": {
                  stroke: "rgba(255, 255, 255, 0.05)",
                  strokeDasharray: "3 3",
                },
              }}
            />
          </div>
        </div>
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