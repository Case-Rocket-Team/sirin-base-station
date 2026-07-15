import { useState } from "react";
import HomePanel from "./panels/HomePanel";
import WindowShell from "./panels/WindowShell";
import TelemetryPanel from "./panels/TelemetryPanel";
import UsbPanel from "./panels/UsbPanel";
import RawDataPanel from "./panels/RawDataPanel";
import SettingsPanel from "./panels/SettingsPanel";
import TimelinePanel from "./panels/TimelinePanel";
import ReplayPanel from "./panels/ReplayPanel";
import RecoveryPanel from "./panels/RecoveryPanel";
import type { AppPage, TelemetrySource } from "./telemetry/types";

export const pages: Array<{ id: Exclude<AppPage, "home">; label: string; description: string }> = [
  { id: "overview", label: "Overview", description: "Flight overview and live telemetry" },
  { id: "raw", label: "Raw Data", description: "Inspect validated packets and manage recording" },
  { id: "timeline", label: "Timeline", description: "Track inferred mission events in sequence" },
  { id: "replay", label: "Replay", description: "Load recorded telemetry and play it back through the UI" },
  { id: "recovery", label: "Recovery", description: "Compare radio callsigns and compute a bearing between positions" },
  { id: "usb", label: "USB Console", description: "USB status and direct Sirin telemetry" },
  { id: "settings", label: "Settings", description: "Adjust telemetry and recording configuration" },
];

export default function App() {
  const [activePage, setActivePage] = useState<AppPage>("home");
  const [selectedSource, setSelectedSource] = useState<TelemetrySource>("lora");

  const activePageMeta = pages.find((page) => page.id === activePage);

  return (
    <div className="h-screen bg-[radial-gradient(circle_at_top,rgba(57,132,255,0.24),transparent_32%),linear-gradient(180deg,#050814_0%,#09101b_48%,#05070e_100%)] text-slate-100 overflow-hidden">
      <div className="app-viewport">
        {activePage === "home" ? (
          <HomePanel pages={pages} selectedSource={selectedSource} onPageChange={setActivePage} />
        ) : (
          <WindowShell title={activePageMeta?.label ?? "Window"} description={activePageMeta?.description ?? ""} onBack={() => setActivePage("home")} selectedSource={selectedSource} onSourceChange={setSelectedSource}>
            <div className="app-window-content">
              {activePage === "overview" && <TelemetryPanel selectedSource={selectedSource} />}
              {activePage === "raw" && <RawDataPanel selectedSource={selectedSource} />}
              {activePage === "timeline" && <TimelinePanel selectedSource={selectedSource} />}
              {activePage === "replay" && <ReplayPanel />}
              {activePage === "recovery" && <RecoveryPanel />}
              {activePage === "usb" && <UsbPanel />}
              {activePage === "settings" && <SettingsPanel selectedSource={selectedSource} />}
            </div>
          </WindowShell>
        )}
      </div>
    </div>
  );
}
