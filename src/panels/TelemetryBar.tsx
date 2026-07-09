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
    <section className="grid gap-px overflow-hidden rounded-[28px] border border-white/10 bg-white/8 shadow-[0_18px_40px_rgba(0,0,0,0.25)] md:grid-cols-5">
      <MetricBox label="Altitude" value={formatNumber(altitudeFt)} unit="ft" />
      <MetricBox label="Expected Apogee" value={formatNumber(apogeeFt)} unit="ft" />
      <div className="flex min-h-[120px] flex-col items-center justify-center bg-[linear-gradient(180deg,rgba(9,16,30,0.96),rgba(4,7,13,1))] px-6 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.45em] text-white">Sirin Base Station</p>
        <p className="mt-3 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.3em] text-cyan-100">
          {flightMode ?? "Unknown"}
        </p>
      </div>
      <MetricBox label="Velocity" value={formatNumber(speedMps)} unit="m/s" />
      <MetricBox label="Acceleration" value={formatNumber(accelTotalG)} unit="g" />
    </section>
  );
}

function MetricBox({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex min-h-[120px] flex-col justify-center bg-[linear-gradient(180deg,rgba(9,16,30,0.96),rgba(4,7,13,1))] px-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan-200/75">{label}</p>
      <div className="mt-2 flex items-end gap-2">
        <span className="font-mono text-3xl font-semibold tracking-[0.08em] text-white">{value}</span>
        <span className="pb-1 text-sm uppercase tracking-[0.18em] text-slate-300">{unit}</span>
      </div>
    </div>
  );
}

function formatNumber(value: number | null) {
  return typeof value === "number" ? Math.round(value).toLocaleString() : "--";
}
