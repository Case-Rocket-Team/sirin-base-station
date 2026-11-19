import { useMemo } from "react";
import { LineChart } from "@mui/x-charts/LineChart";
import { useEkfDebug, type EkfPoint } from "../telemetry/useEkfDebug";
import type { EkfSettingsData, TelemetrySource } from "../telemetry/types";

/** Max points drawn per chart; the buffer holds up to 3000. */
const MAX_DRAWN_POINTS = 600;

const AXIS_COLORS = ["#f87171", "#4ade80", "#60a5fa"] as const;
const AXIS_NAMES = ["X", "Y", "Z"] as const;

type XyzKey = Exclude<keyof EkfPoint, "t">;

type ChartSpec = {
  key: XyzKey;
  title: string;
  unit: string;
};

const BIAS_CHARTS: ChartSpec[] = [
  { key: "gyroBiasDps", title: "Gyro Bias", unit: "°/s" },
  { key: "accelBiasMg", title: "Accel Bias", unit: "mg" },
  { key: "magBiasUt", title: "Mag Bias", unit: "µT" },
];

const SIGMA_CHARTS: ChartSpec[] = [
  { key: "attitudeSigmaDeg", title: "Attitude σ", unit: "°" },
  { key: "velocitySigmaMps", title: "Velocity σ", unit: "m/s" },
  { key: "positionSigmaM", title: "Position σ", unit: "m" },
  { key: "gyroBiasSigmaDps", title: "Gyro Bias σ", unit: "°/s" },
  { key: "accelBiasSigmaMg", title: "Accel Bias σ", unit: "mg" },
  { key: "magBiasSigmaUt", title: "Mag Bias σ", unit: "µT" },
];

/**
 * Live EKF debug data from the selected source. Owns its own subscription so its 10 Hz
 * updates don't re-render the rest of RawDataPanel.
 */
export default function EkfDebugSection({ source }: { source: TelemetrySource }) {
  const { points, settings, live } = useEkfDebug(source);

  const drawn = useMemo(() => decimate(points, MAX_DRAWN_POINTS), [points]);
  const times = useMemo(() => drawn.map((p) => p.t), [drawn]);
  const latest = points[points.length - 1];

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">EKF Debug</p>
        <span className="font-mono text-[9px] text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/40">
          {live && latest ? `Board t: ${latest.t.toFixed(2)} s | Pts: ${points.length}` : "No data"}
        </span>
      </div>

      {!live || !latest ? (
        <div className="rounded-lg border border-white/8 bg-black/25 p-6 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400">
          No EKF debug data
        </div>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-3">
            {BIAS_CHARTS.map((spec) => (
              <XyzChart key={spec.key} spec={spec} points={drawn} times={times} latest={latest} height={220} />
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {SIGMA_CHARTS.map((spec) => (
              <XyzChart key={spec.key} spec={spec} points={drawn} times={times} latest={latest} height={200} />
            ))}
          </div>

          {settings && <SettingsTable settings={settings} />}
        </>
      )}
    </div>
  );
}

function XyzChart({
  spec,
  points,
  times,
  latest,
  height,
}: {
  spec: ChartSpec;
  points: EkfPoint[];
  times: number[];
  latest: EkfPoint;
  height: number;
}) {
  const series = AXIS_NAMES.map((name, axis) => ({
    data: points.map((p) => p[spec.key][axis]),
    label: name,
    color: AXIS_COLORS[axis],
    showMark: false,
    valueFormatter: (v: number | null) => (v == null ? "--" : `${formatNumber(v)} ${spec.unit}`),
  }));

  const tEnd = latest.t;
  const tStart = Math.min(times[0] ?? tEnd, tEnd - 1);

  return (
    <div className="min-w-0 rounded-lg border border-white/8 bg-black/25 p-2 overflow-hidden">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-200/75">
          {spec.title} <span className="text-slate-400 normal-case tracking-normal">({spec.unit})</span>
        </p>
        <p className="font-mono text-[9px] text-slate-300 truncate">
          {latest[spec.key].map((v, i) => `${AXIS_NAMES[i]} ${v == null ? "--" : formatNumber(v)}`).join("  ")}
        </p>
      </div>
      <LineChart
        height={height}
        skipAnimation
        series={series}
        xAxis={[
          {
            scaleType: "linear",
            data: times,
            min: tStart,
            max: tEnd,
            label: "Board time (s)",
            valueFormatter: (v: number) => v.toFixed(1),
            tickLabelStyle: { fill: "#94a3b8", fontSize: 9 },
          },
        ]}
        yAxis={[
          {
            width: 55,
            valueFormatter: (v: number) => formatNumber(v),
            tickLabelStyle: { fill: "#fefefe", fontSize: 9 },
          },
        ]}
        margin={{ top: 10, right: 15, bottom: 10, left: 5 }}
        grid={{ horizontal: true }}
        sx={chartSx}
      />
    </div>
  );
}

function SettingsTable({ settings }: { settings: EkfSettingsData }) {
  const scalars: [string, number, string][] = [
    ["Accel noise var", settings.accel_var_f2ps4, "ft²/s⁴"],
    ["Accel bias walk var", settings.accel_bias_var_f2ps4, "ft²/s⁴ per s"],
    ["Gyro noise var", settings.gyro_var_rad2ps2, "rad²/s²"],
    ["Gyro bias walk var", settings.gyro_bias_var_rad2ps2, "rad²/s² per s"],
    ["Baro var", settings.baro_var_ft2, "ft²"],
    ["Mag bias walk var", settings.magn_bias_var_gauss2, "gauss² per s"],
  ];

  return (
    <div className="rounded-lg border border-white/8 bg-black/25 p-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-200/75">EKF Settings</p>
      <div className="mt-2 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <table className="text-[9px] text-slate-200">
          <tbody>
            {scalars.map(([label, value, unit]) => (
              <tr key={label} className="border-b border-white/5 last:border-0">
                <td className="py-0.5 pr-3 text-slate-400">{label}</td>
                <td className="py-0.5 pr-2 font-mono text-right">{formatSetting(value)}</td>
                <td className="py-0.5 text-slate-400">{unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <MatrixGrid title="Mag covariance" unit="gauss²" values={settings.magn_covar_gauss2} />
        <MatrixGrid title="GPS covariance" unit="ft²" values={settings.gnss_covar_ft2} />
      </div>
    </div>
  );
}

function MatrixGrid({ title, unit, values }: { title: string; unit: string; values: number[] }) {
  return (
    <div>
      <p className="text-[9px] text-slate-400 mb-1">
        {title} <span className="text-slate-500">({unit})</span>
      </p>
      <div className="grid grid-cols-3 gap-px rounded border border-white/10 bg-white/10 overflow-hidden">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-slate-200 text-right">
            {formatSetting(values?.[i])}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Keep every Nth point so at most `max` are drawn; always keeps the newest. */
function decimate(points: EkfPoint[], max: number): EkfPoint[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const out: EkfPoint[] = [];
  // Anchor on the newest point so the right edge doesn't jitter between flushes.
  for (let i = points.length - 1; i >= 0; i -= step) out.push(points[i]);
  return out.reverse();
}

function formatNumber(v: number): string {
  const abs = Math.abs(v);
  if (abs !== 0 && (abs < 0.001 || abs >= 100000)) return v.toExponential(2);
  return v.toPrecision(3);
}

function formatSetting(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "--";
  if (v === 0) return "0";
  const abs = Math.abs(v);
  return abs < 0.01 || abs >= 10000 ? v.toExponential(3) : v.toPrecision(4);
}

const chartSx = {
  width: "100%",
  "& .MuiChartsLegend-root, & .MuiChartsLegend-label": {
    color: "#f8fafc !important",
    fontSize: "10px !important",
  },
  "& .MuiChartsAxis-line, & .MuiChartsAxis-tick": {
    stroke: "rgba(255, 255, 255, 0.4) !important",
  },
  "& .MuiChartsAxis-label": {
    fill: "#94a3b8 !important",
    fontSize: "9px",
  },
  "& .MuiChartsGrid-line": {
    stroke: "rgba(255, 255, 255, 0.05)",
    strokeDasharray: "3 3",
  },
};
