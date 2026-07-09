import { useMemo, useState } from "react";
import InitializationPanel from "./panels/InitializationPanel";
import TelemetryPanel from "./panels/TelemetryPanel";
import UsbPanel from "./panels/UsbPanel";
import RawDataPanel from "./panels/RawDataPanel";
import SettingsPanel from "./panels/SettingsPanel";
import TimelinePanel from "./panels/TimelinePanel";
import ReplayPanel from "./panels/ReplayPanel";
import RecoveryPanel from "./panels/RecoveryPanel";
import type { AppPage, TelemetrySource } from "./telemetry/types";

const pages: Array<{ id: AppPage; label: string; description: string }> = [
  { id: "overview", label: "Overview", description: "Flight overview and live telemetry" },
  { id: "raw", label: "Raw Data", description: "Inspect validated packets and manage recording" },
  { id: "timeline", label: "Timeline", description: "Track inferred mission events in sequence" },
  { id: "replay", label: "Replay", description: "Load recorded telemetry and play it back through the UI" },
  { id: "recovery", label: "Recovery", description: "Compare radio callsigns and compute a bearing between positions" },
  { id: "usb", label: "USB Console", description: "USB status and direct Sirin telemetry" },
  { id: "settings", label: "Settings", description: "Adjust telemetry and recording configuration" },
];

export default function App() {
  const [activePage, setActivePage] = useState<AppPage>("overview");
  const [selectedSource, setSelectedSource] = useState<TelemetrySource>("lora");

  const activePageMeta = useMemo(
    () => pages.find((page) => page.id === activePage) ?? pages[0],
    [activePage],
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(57,132,255,0.24),_transparent_32%),linear-gradient(180deg,_#050814_0%,_#09101b_48%,_#05070e_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <InitializationPanel
          activePage={activePage}
          activePageDescription={activePageMeta.description}
          pages={pages}
          selectedSource={selectedSource}
          onPageChange={setActivePage}
          onSourceChange={setSelectedSource}
        />

        <div className="mt-4 flex-1">
          {activePage === "overview" && <TelemetryPanel selectedSource={selectedSource} />}
          {activePage === "raw" && <RawDataPanel selectedSource={selectedSource} />}
          {activePage === "timeline" && <TimelinePanel selectedSource={selectedSource} />}
          {activePage === "replay" && <ReplayPanel />}
          {activePage === "recovery" && <RecoveryPanel />}
          {activePage === "usb" && <UsbPanel />}
          {activePage === "settings" && <SettingsPanel selectedSource={selectedSource} />}
        </div>
      </div>
    </div>
  );
}
