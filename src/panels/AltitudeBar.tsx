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
    <section className="rounded-[20px] border border-white/10 bg-slate-950/55 p-2 backdrop-blur">
      <div className="rounded-lg border border-white/10 bg-black/25 p-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-200/75">Altitude</p>
        <p className="mt-1 font-mono text-2xl font-semibold text-white">
          {clampedAltitude === null ? "--" : Math.round(clampedAltitude).toLocaleString()}
          <span className="ml-1 text-xs tracking-[0.18em] text-slate-300">ft</span>
        </p>
      </div>

      <div className="relative mt-2 h-[160px] rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,64,64,0.65)_0%,rgba(255,194,77,0.65)_22%,rgba(73,255,168,0.68)_75%,rgba(255,194,77,0.65)_90%,rgba(255,64,64,0.65)_100%)] p-2">
        <div className="relative h-full rounded-[12px] border border-black/40 bg-[linear-gradient(180deg,rgba(7,11,20,0.15),rgba(7,11,20,0.7))]">
          <div className="absolute inset-x-2 bottom-0 rounded-b-[10px] bg-[linear-gradient(180deg,rgba(21,29,43,0.25),rgba(3,6,12,0.95))]" style={{ height: `${100 - percent}%` }} />
          <div className="absolute left-2 right-2 border-t border-dashed border-white/70" style={{ bottom: `${targetPercent}%` }} />
          <div
            className="absolute left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-white/50 bg-white/20 text-xs shadow-[0_0_18px_rgba(255,255,255,0.3)]"
            style={{ bottom: `calc(${percent}% - 12px)` }}
          >
            ^
          </div>
        </div>
      </div>
    </section>
  );
}
