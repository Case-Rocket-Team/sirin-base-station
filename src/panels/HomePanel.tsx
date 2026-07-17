import { useTelemetrySource } from "../telemetry/useTelemetrySource";
import type { AppPage, LinkStatus, TelemetrySource } from "../telemetry/types";

type Page = { id: Exclude<AppPage, "home">; label: string; description: string };
type Props = { pages: Page[]; selectedSource: TelemetrySource; onPageChange: (page: AppPage) => void };

export default function HomePanel({ pages, selectedSource, onPageChange }: Props) {
  const telemetry = useTelemetrySource(selectedSource);
  const snapshot = telemetry.snapshot;
  return (
    <main className="home-screen">
      <section className="home-brand">
        <p className="eyebrow">Case Rocket Team</p>
        <h1>Sirin Base Station</h1>
        <p>Mission control interface</p>
      </section>
      <section className="home-statuses" aria-label="Connection status">
        <ConnectionStatus label="SDRPlay / LoRa" status={snapshot?.loraStatus} />
        <ConnectionStatus label="Sirin / USB" status={snapshot?.usbStatus} />
      </section>
      <nav className="home-navigation" aria-label="Base station windows">
        {pages.map((page) => <button key={page.id} className="home-nav-card" onClick={() => onPageChange(page.id)}><span>{page.label}</span><small>{page.description}</small><b aria-hidden="true">→</b></button>)}
      </nav>
    </main>
  );
}

function ConnectionStatus({ label, status }: { label: string; status: LinkStatus | undefined }) {
  const connected = status?.state === "connected";
  const state = status?.state ?? "checking";
  return <div className={`connection-status ${connected ? "connected" : state === "error" ? "error" : ""}`}><span className="status-dot" /><div><span>{label}</span><strong>{connected ? "Connected" : state === "checking" ? "Checking" : "Not connected"}</strong></div></div>;
}
