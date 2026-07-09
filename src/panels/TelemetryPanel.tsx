import AltitudeBar from "./AltitudeBar";
import RocketOrientation from "./RocketOrientation";
import TelemetryBar from "./TelemetryBar";
import TelemetryStatus from "./TelemetryStatus";
import ThreeDPosition from "./3DPosition";
import TimelineStrip from "./TimelineStrip";
import { useTelemetrySource } from "../telemetry/useTelemetrySource";
import type { TelemetrySource } from "../telemetry/types";
import CRTLogo from "./CRTLogo";

type Props = {
  selectedSource: TelemetrySource;
};

export default function TelemetryPanel({ selectedSource }: Props) {
  const telemetry = useTelemetrySource(selectedSource);
  const fields = telemetry.packet?.fields;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        <TelemetryStatus
          source={selectedSource}
          status={telemetry.status}
          packet={telemetry.packet}
          expectedPacketsPerSecond={telemetry.snapshot?.config.expectedPacketsPerSecond ?? 10}
          staleTimeoutMs={telemetry.snapshot?.config.staleTimeoutMs ?? 3000}
        />

        <section className="grid min-h-[620px] gap-4 md:grid-cols-2">
          <div className="rounded-[28px] border border-white/10 bg-slate-950/50 p-4 backdrop-blur">
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-200/75">
              Orientation
            </p>
            <div className="mt-3 h-[300px] overflow-hidden rounded-2xl border border-white/8 bg-black/20">
              <RocketOrientation
                quatW={fields?.quatW ?? null}
                quatX={fields?.quatX ?? null}
                quatY={fields?.quatY ?? null}
                quatZ={fields?.quatZ ?? null}
              />
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-slate-950/50 p-4 backdrop-blur">
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-200/75">
              Position Trace
            </p>
            <div className="mt-3 h-[300px] overflow-hidden rounded-2xl border border-white/8 bg-black/20">
              <ThreeDPosition
                x={fields?.positionXM ?? null}
                y={fields?.positionYM ?? null}
                z={fields?.positionZM ?? null}
              />
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-slate-950/50 p-4 backdrop-blur md:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-200/75">Raw Packet</p>
                <p className="mt-2 text-sm text-slate-300">Latest validated payload for the selected telemetry source.</p>
              </div>
              <CRTLogo className="h-28 w-28 shrink-0" />
            </div>
            <pre className="mt-3 max-h-[280px] overflow-auto rounded-2xl border border-white/8 bg-black/30 p-4 text-xs text-slate-200">
              {telemetry.packet ? JSON.stringify(telemetry.packet.raw, null, 2) : "No packet received yet."}
            </pre>
          </div>
        </section>

        <AltitudeBar
          altitudeFt={fields?.altitudeAglFt ?? null}
          minFt={telemetry.snapshot?.config.altitudeMinFt ?? 0}
          maxFt={telemetry.snapshot?.config.altitudeMaxFt ?? 40000}
          targetFt={telemetry.snapshot?.config.targetAltitudeFt ?? 30000}
        />
      </div>

      <TimelineStrip timeline={telemetry.timelineState ?? null} />

      <TelemetryBar
        altitudeFt={fields?.altitudeAglFt ?? null}
        apogeeFt={fields?.expectedApogeeFt ?? null}
        flightMode={fields?.flightMode ?? null}
        speedMps={fields?.speedMps ?? null}
        accelTotalG={fields?.accelTotalG ?? null}
      />
    </div>
  );
}
