import type { ReactNode } from "react";
import type { TelemetrySource } from "../telemetry/types";

type Props = { title: string; description: string; onBack: () => void; children: ReactNode; selectedSource: TelemetrySource; onSourceChange: (source: TelemetrySource) => void };

export default function WindowShell({ title, description, onBack, children, selectedSource, onSourceChange }: Props) {
  return (
    <main className="app-window">
      <div className="window-toolbar">
        <button onClick={onBack} className="window-back" aria-label="Return to home">
          <span aria-hidden="true">←</span> Home
        </button>
        <div className="window-heading">
          <p className="eyebrow">Sirin Base Station</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="source-toggle window-source-toggle">
          {(["lora", "usb"] as const).map((source) => <button key={source} onClick={() => onSourceChange(source)} className={selectedSource === source ? "active" : ""}>{source}</button>)}
        </div>
      </div>
      {children}
    </main>
  );
}
