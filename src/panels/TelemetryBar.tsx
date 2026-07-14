type Props = {
  altitudeFt: number | null;
  apogeeFt: number | null;
  flightMode: string | null;
  speedMps: number | null;
  accelTotalG: number | null;
};

export default function TelemetryBar({
  altitudeFt,
  apogeeFt,
  flightMode,
  speedMps,
  accelTotalG,
}: Props) {
  return (
    <section className="grid gap-px overflow-hidden rounded-[20px] border border-white/10 bg-white/8 shadow-[0_18px_40px_rgba(0,0,0,0.25)] grid-cols-5">
      <MetricBox label="Alt" value={formatNumber(altitudeFt)} unit="ft" />
      <MetricBox label="Apogee" value={formatNumber(apogeeFt)} unit="ft" />
      <div className="flex min-h-[70px] flex-col items-center justify-center bg-[linear-gradient(180deg,rgba(9,16,30,0.96),rgba(4,7,13,1))] px-3 text-center">
        <p className="font-mono text-[9px] uppercase tracking-[0.45em] text-white">Sirin</p>
        <p className="mt-1 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.3em] text-cyan-100">
          {flightMode ?? "Unknown"}
        </p>
      </div>
      <MetricBox label="Velocity" value={formatNumber(speedMps)} unit="m/s" />
      <MetricBox label="Accel" value={formatNumber(accelTotalG)} unit="g" />
    </section>
  );
}

function MetricBox({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex min-h-[70px] flex-col justify-center bg-[linear-gradient(180deg,rgba(9,16,30,0.96),rgba(4,7,13,1))] px-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-cyan-200/75">{label}</p>
      <div className="mt-1 flex items-end gap-1">
        <span className="font-mono text-xl font-semibold tracking-[0.08em] text-white">{value}</span>
        <span className="pb-0.5 text-xs uppercase tracking-[0.18em] text-slate-300">{unit}</span>
      </div>
    </div>
  );
}

function formatNumber(value: number | null) {
  return typeof value === "number" ? Math.round(value).toLocaleString() : "--";
}
