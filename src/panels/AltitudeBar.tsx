type Props = {
  altitudeFt: number | null;
  minFt: number;
  maxFt: number;
  targetFt: number;
};

export default function AltitudeBar({ altitudeFt, minFt, maxFt, targetFt }: Props) {
  const clampedAltitude =
    typeof altitudeFt === "number" ? Math.min(maxFt, Math.max(minFt, altitudeFt)) : null;
  const percent =
    clampedAltitude === null ? 0 : ((clampedAltitude - minFt) / Math.max(1, maxFt - minFt)) * 100;
  const targetPercent = ((targetFt - minFt) / Math.max(1, maxFt - minFt)) * 100;

  return (
    <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-4 backdrop-blur">
      <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan-200/75">Altitude</p>
        <p className="mt-2 font-mono text-3xl font-semibold text-white">
          {clampedAltitude === null ? "--" : Math.round(clampedAltitude).toLocaleString()}
          <span className="ml-2 text-sm tracking-[0.18em] text-slate-300">ft</span>
        </p>
      </div>

      <div className="relative mt-4 h-[520px] rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,64,64,0.65)_0%,rgba(255,194,77,0.65)_22%,rgba(73,255,168,0.68)_75%,rgba(255,194,77,0.65)_90%,rgba(255,64,64,0.65)_100%)] p-3">
        <div className="relative h-full rounded-[18px] border border-black/40 bg-[linear-gradient(180deg,rgba(7,11,20,0.15),rgba(7,11,20,0.7))]">
          <div className="absolute inset-x-4 bottom-0 rounded-b-[12px] bg-[linear-gradient(180deg,rgba(21,29,43,0.25),rgba(3,6,12,0.95))]" style={{ height: `${100 - percent}%` }} />
          <div className="absolute left-3 right-3 border-t border-dashed border-white/70" style={{ bottom: `${targetPercent}%` }} />
          <div
            className="absolute left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-white/50 bg-white/20 text-lg shadow-[0_0_18px_rgba(255,255,255,0.3)]"
            style={{ bottom: `calc(${percent}% - 20px)` }}
          >
            ^
          </div>
        </div>
      </div>
    </section>
  );
}
