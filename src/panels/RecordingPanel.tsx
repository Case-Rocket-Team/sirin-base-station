import { useEffect, useState } from "react";
import TelemetryPanel from "./TelemetryPanel";
import RawDataPanel from "./RawDataPanel";
import { useTelemetrySource } from "../telemetry/useTelemetrySource";
import type { TelemetrySource } from "../telemetry/types";

type DisplayMode = "overview" | "raw";

type Props = {
  selectedSource: TelemetrySource;
};

export default function RecordingPanel({ selectedSource }: Props) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>("overview");
  const telemetry = useTelemetrySource(selectedSource);

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex gap-2 px-2 pt-2">
        <button
          onClick={() => setDisplayMode("overview")}
          className={`px-3 py-1 rounded-lg font-mono text-[9px] uppercase tracking-[0.25em] transition ${
            displayMode === "overview"
              ? "bg-cyan-500/90 text-white"
              : "bg-white/10 text-slate-300 hover:bg-white/20"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setDisplayMode("raw")}
          className={`px-3 py-1 rounded-lg font-mono text-[9px] uppercase tracking-[0.25em] transition ${
            displayMode === "raw"
              ? "bg-cyan-500/90 text-white"
              : "bg-white/10 text-slate-300 hover:bg-white/20"
          }`}
        >
          Detailed
        </button>
      </div>

      <div className="flex-1 overflow-auto px-2">
        {displayMode === "overview" ? (
          <TelemetryPanel selectedSource={selectedSource} />
        ) : (
          <RawDataPanel selectedSource={selectedSource} />
        )}
      </div>
    </div>
  );
}
