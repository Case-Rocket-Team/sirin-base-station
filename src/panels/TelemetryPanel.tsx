import AltitudeBar from "./AltitudeBar";
import RocketOrientation from "./RocketOrientation";
import TelemetryBar from "./TelemetryBar";
import TelemetryStatus from "./TelemetryStatus";
import ThreeDPosition from "./3DPosition";
import TimelineBar from "./TimelineBar";
import { useTelemetrySource } from "../telemetry/useTelemetrySource";
import type { TelemetrySource, TimelineStage } from "../telemetry/types";

type Props = {
  selectedSource: TelemetrySource;
};

const orderedStages: TimelineStage[] = ["standby", "launch", "burnout", "apogee", "drogue", "main", "landed"];

export default function TelemetryPanel({ selectedSource }: Props) {
  const telemetry = useTelemetrySource(selectedSource);
  const fields = telemetry.packet?.fields;

  return (
    <div className="dashboard-shell">
      <div className="dashboard-card dashboard-altitude">
        <AltitudeBar
          altitudeFt={fields?.altitudeAglFt ?? null}
          minFt={telemetry.snapshot?.config.altitudeMinFt ?? 0}
          maxFt={telemetry.snapshot?.config.altitudeMaxFt ?? 40000}
          targetFt={telemetry.snapshot?.config.targetAltitudeFt ?? 30000}
        />
      </div>

      <div className="dashboard-card dashboard-status">
        <TelemetryStatus
          source={selectedSource}
          status={telemetry.status}
          packet={telemetry.packet}
          expectedPacketsPerSecond={telemetry.snapshot?.config.expectedPacketsPerSecond ?? 10}
          staleTimeoutMs={telemetry.snapshot?.config.staleTimeoutMs ?? 3000}
        />

      </div>

      <div className="dashboard-card dashboard-orientation">
        <div className="orientation-frame">
          <RocketOrientation quatW={fields?.quatW ?? null} quatX={fields?.quatX ?? null} quatY={fields?.quatY ?? null} quatZ={fields?.quatZ ?? null} />
        </div>
      </div>

      <div className="dashboard-card dashboard-apogee p-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">Apogee Predictor</p>
        <p className="mt-2 font-mono text-2xl font-semibold text-white">{fields?.expectedApogeeFt == null ? "--" : Math.round(fields.expectedApogeeFt).toLocaleString()}<span className="ml-1 text-xs text-slate-400">ft</span></p>
        <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-slate-400">Expected maximum altitude</p>
      </div>

      <div className="dashboard-card dashboard-position">
        <p className="p-2 font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/75">Position Trace</p>
        <div className="h-[calc(100%-2rem)] min-h-[12rem] overflow-hidden">
          <ThreeDPosition x={fields?.positionXM ?? null} y={fields?.positionYM ?? null} z={fields?.positionZM ?? null} />
        </div>
      </div>

      <div className="dashboard-card dashboard-telemetry">
        <TimelineBar timeline={telemetry.timelineState} />
        <TelemetryBar altitudeFt={fields?.altitudeAglFt ?? null} apogeeFt={fields?.expectedApogeeFt ?? null} flightMode={fields?.flightMode ?? null} speedMps={fields?.speedMps ?? null} accelTotalG={fields?.accelTotalG ?? null} />
      </div>
    </div>
  );
}
