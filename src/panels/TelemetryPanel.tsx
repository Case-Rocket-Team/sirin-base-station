import AltitudeBar from "./AltitudeBar";
import RocketOrientation from "./RocketOrientation";
import TelemetryBar from "./TelemetryBar";
import TelemetryStatus from "./TelemetryStatus";
import ThreeDPosition from "./3DPosition";
import TimelineStrip from "./TimelineStrip";
import { useTelemetrySource } from "../telemetry/useTelemetrySource";
import type { TelemetrySource } from "../telemetry/types";

type Props = {
  selectedSource: TelemetrySource;
};

export default function TelemetryPanel({ selectedSource }: Props) {
  const telemetry = useTelemetrySource(selectedSource);
  const fields = telemetry.packet?.fields;

  return (
    <div className="flex h-full flex-col gap-1">
      <div className="grid gap-1 grid-cols-[280px_180px_180px_minmax(0,1fr)_220px]">
        <TelemetryStatus
          source={selectedSource}
          status={telemetry.status}
          packet={telemetry.packet}
          expectedPacketsPerSecond={telemetry.snapshot?.config.expectedPacketsPerSecond ?? 10}
          staleTimeoutMs={telemetry.snapshot?.config.staleTimeoutMs ?? 3000}
        />

        <div className="rounded-[20px] border border-white/10 bg-slate-950/50 p-2 backdrop-blur">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">
            Orientation
          </p>
          <div className="mt-1 h-[130px] overflow-hidden rounded-lg border border-white/8 bg-black/20">
            <RocketOrientation
              quatW={fields?.quatW ?? null}
              quatX={fields?.quatX ?? null}
              quatY={fields?.quatY ?? null}
              quatZ={fields?.quatZ ?? null}
            />
          </div>
        </div>

        <div className="rounded-[20px] border border-white/10 bg-slate-950/50 p-2 backdrop-blur">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">
            Position Trace
          </p>
          <div className="mt-1 h-[130px] overflow-hidden rounded-lg border border-white/8 bg-black/20">
            <ThreeDPosition
              x={fields?.positionXM ?? null}
              y={fields?.positionYM ?? null}
              z={fields?.positionZM ?? null}
            />
          </div>
        </div>

        <div className="rounded-[20px] border border-white/10 bg-slate-950/50 p-2 backdrop-blur">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">Raw Packet</p>
          <pre className="mt-1 h-[135px] overflow-auto rounded-lg border border-white/8 bg-black/30 p-1 text-[9px] text-slate-200">
            {telemetry.packet ? JSON.stringify(telemetry.packet.raw, null, 2) : "No packet."}
          </pre>
        </div>

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
