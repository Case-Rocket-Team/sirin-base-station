import { useState, useEffect } from "react";
import TelemetryStatus from "./TelemetryStatus";
import { useTelemetrySource } from "../telemetry/useTelemetrySource";
import type { UsbDeviceInfo, UsbConfigPayload, FlightSummary, SirinMode } from "../telemetry/types";

type TabName = "telemetry" | "config" | "mode" | "flights" | "actions" | "gps";

export default function UsbPanel() {
  const telemetry = useTelemetrySource("usb");
  const [activeTab, setActiveTab] = useState<TabName>("telemetry");
  const [devices, setDevices] = useState<UsbDeviceInfo[]>([]);
  const [usbCommand, setUsbCommand] = useState("tail_on");
  const [usbMessage, setUsbMessage] = useState<string | null>(null);
  const [config, setConfig] = useState<UsbConfigPayload | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [currentMode, setCurrentMode] = useState<string | null>(null);
  const [flights, setFlights] = useState<FlightSummary[]>([]);
  const [flightsLoading, setFlightsLoading] = useState(false);
  const [eraseConfirming, setEraseConfirming] = useState(false);

  // Load USB devices on mount
  useEffect(() => {
    telemetry
      .getUsbDevices()
      .then(setDevices)
      .catch((error) => {
        setUsbMessage(error instanceof Error ? error.message : String(error));
      });
  }, []);

  const handleConnect = async (deviceId: string) => {
    try {
      const response = await telemetry.connectUsb(deviceId);
      setUsbMessage(response);
      setDevices(await telemetry.getUsbDevices());
      await telemetry.refreshSnapshot();
    } catch (error) {
      setUsbMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const handleSendCommand = async () => {
    try {
      setUsbMessage(await telemetry.sendUsbCommand(usbCommand));
      await telemetry.refreshSnapshot();
    } catch (error) {
      setUsbMessage(error instanceof Error ? error.message : String(error));
    }
  };

  // Config tab functions
  const loadConfig = async () => {
    try {
      setConfigLoading(true);
      const cfg = await telemetry.usbQueryConfig();
      setConfig(cfg);
      setUsbMessage("Config loaded");
    } catch (error) {
      setUsbMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setConfigLoading(false);
    }
  };

  const saveConfig = async (nickname: string, callsign: string, id: number) => {
    try {
      const result = await telemetry.usbSetConfig(nickname, callsign, id);
      setConfig(result);
      setUsbMessage("Config saved successfully");
    } catch (error) {
      setUsbMessage(error instanceof Error ? error.message : String(error));
    }
  };

  // Mode tab functions
  const loadMode = async () => {
    try {
      const mode = await telemetry.usbQueryMode();
      setCurrentMode(mode);
      setUsbMessage(`Current mode: ${mode}`);
    } catch (error) {
      setUsbMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const setMode = async (mode: SirinMode) => {
    try {
      const result = await telemetry.usbSetMode(mode);
      setCurrentMode(result);
      setUsbMessage(`Mode set to ${result}`);
    } catch (error) {
      setUsbMessage(error instanceof Error ? error.message : String(error));
    }
  };

  // Flights tab functions
  const loadFlights = async () => {
    try {
      setFlightsLoading(true);
      const flightList = await telemetry.usbQueryFlights();
      setFlights(flightList);
      setUsbMessage(`Loaded ${flightList.length} flights`);
    } catch (error) {
      setUsbMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setFlightsLoading(false);
    }
  };

  const exportFlight = async (index: number) => {
    try {
      const path = await telemetry.usbExportFlight(index);
      setUsbMessage(`Flight exported to ${path}`);
    } catch (error) {
      setUsbMessage(error instanceof Error ? error.message : String(error));
    }
  };

  // Actions
  const reboot = async () => {
    try {
      await telemetry.usbReboot();
      setUsbMessage("Reboot command sent");
    } catch (error) {
      setUsbMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const eraseFlash = async () => {
    try {
      await telemetry.usbEraseFlash();
      setUsbMessage("Flash erase completed");
      setEraseConfirming(false);
    } catch (error) {
      setUsbMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="responsive-panel-grid responsive-panel-grid-usb">
      {/* Header Section */}
      <TelemetryStatus
        source="usb"
        status={telemetry.status}
        packet={telemetry.packet}
        expectedPacketsPerSecond={telemetry.snapshot?.config.expectedPacketsPerSecond ?? 10}
        staleTimeoutMs={telemetry.snapshot?.config.staleTimeoutMs ?? 3000}
      />

      <div className="rounded-lg border border-white/8 bg-black/25 p-2">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-white">
          Fields
        </h2>
        <dl className="mt-1 space-y-0.5 text-[9px] text-slate-200">
          <div>
            <dt className="text-slate-400 text-[8px]">Mode</dt>
            <dd className="text-[9px]">{telemetry.packet?.fields.flightMode ?? "--"}</dd>
          </div>
          <div>
            <dt className="text-slate-400 text-[8px]">Alt</dt>
            <dd className="text-[9px]">{formatMaybeNumber(telemetry.packet?.fields.altitudeAglFt, "ft")}</dd>
          </div>
          <div>
            <dt className="text-slate-400 text-[8px]">Speed</dt>
            <dd className="text-[9px]">{formatMaybeNumber(telemetry.packet?.fields.speedMps, "m/s")}</dd>
          </div>
          <div>
            <dt className="text-slate-400 text-[8px]">Accel</dt>
            <dd className="text-[9px]">{formatMaybeNumber(telemetry.packet?.fields.accelTotalG, "g")}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-white/8 bg-black/25 p-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400">Devices</p>
        <div className="mt-1 space-y-0.5 text-[9px] text-slate-200">
          {devices.map((device) => (
            <button
              key={`${device.busNumber}-${device.address}`}
              onClick={() => void handleConnect(`${device.busNumber}:${device.address}`)}
              className={`block w-full rounded-lg border px-1.5 py-0.5 text-left text-[9px] ${device.isSirin ? "border-emerald-400/30 bg-emerald-400/10" : "border-white/10 bg-white/5"}`}
            >
              {device.description}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs Section */}
      <div className="rounded-lg border border-white/8 bg-black/25 p-2 col-span-full">
        <div className="flex gap-1 border-b border-white/10 mb-2">
          {(["telemetry", "config", "mode", "flights", "actions", "gps"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2 py-1 text-[9px] font-mono uppercase tracking-wider border-b-2 ${
                activeTab === tab
                  ? "border-cyan-300 text-cyan-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Telemetry Tab */}
        {activeTab === "telemetry" && (
          <div className="space-y-2">
            <div className="flex gap-0.5">
              <select
                value={usbCommand}
                onChange={(event) => setUsbCommand(event.target.value)}
                className="flex-1 rounded-lg border border-white/10 bg-slate-900/80 px-1.5 py-1 text-slate-100 outline-none text-[10px]"
              >
                <option value="tail_on">tail_on</option>
                <option value="tail_off">tail_off</option>
              </select>
              <button
                onClick={() => void handleSendCommand()}
                className="rounded-lg bg-cyan-300 px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-slate-950"
              >
                Send
              </button>
            </div>
          </div>
        )}

        {/* Config Tab */}
        {activeTab === "config" && (
          <div className="space-y-2">
            {!config ? (
              <button
                onClick={() => void loadConfig()}
                disabled={configLoading}
                className="rounded-lg bg-cyan-300 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-slate-950 disabled:opacity-50"
              >
                {configLoading ? "Loading..." : "Load Config"}
              </button>
            ) : (
              <ConfigEditor config={config} onSave={saveConfig} />
            )}
          </div>
        )}

        {/* Mode Tab */}
        {activeTab === "mode" && (
          <div className="space-y-2">
            <div className="text-[9px] text-slate-300 mb-2">
              Current: <span className="text-cyan-300">{currentMode || "Unknown"}</span>
            </div>
            <div className="flex gap-1">
              {["standby", "flight", "landed"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => void setMode(mode as SirinMode)}
                  className="flex-1 rounded-lg bg-slate-700 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-slate-100 hover:bg-slate-600"
                >
                  {mode}
                </button>
              ))}
            </div>
            {!currentMode && (
              <button
                onClick={() => void loadMode()}
                className="rounded-lg bg-cyan-300 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-slate-950 w-full"
              >
                Query Mode
              </button>
            )}
          </div>
        )}

        {/* Flights Tab */}
        {activeTab === "flights" && (
          <div className="space-y-2">
            {flights.length === 0 ? (
              <button
                onClick={() => void loadFlights()}
                disabled={flightsLoading}
                className="rounded-lg bg-cyan-300 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-slate-950 w-full disabled:opacity-50"
              >
                {flightsLoading ? "Loading..." : "List Flights"}
              </button>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {flights.map((flight) => (
                  <div key={flight.index} className="flex justify-between items-center gap-2 text-[9px] border border-white/10 rounded p-1">
                    <span className="text-slate-300">
                      <span className="text-cyan-300">#{flight.index}</span> {flight.dateLabel}
                    </span>
                    <button
                      onClick={() => void exportFlight(flight.index)}
                      className="bg-slate-700 hover:bg-slate-600 px-2 py-0.5 rounded text-slate-100"
                    >
                      Export
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions Tab */}
        {activeTab === "actions" && (
          <div className="space-y-2">
            <button
              onClick={() => void reboot()}
              className="w-full rounded-lg bg-orange-600 hover:bg-orange-700 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-white"
            >
              Reboot Device
            </button>
            {!eraseConfirming ? (
              <button
                onClick={() => setEraseConfirming(true)}
                className="w-full rounded-lg bg-red-700 hover:bg-red-800 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-white"
              >
                Erase Flash (⚠️ Destructive)
              </button>
            ) : (
              <div className="border border-red-500/50 bg-red-500/10 rounded p-2 space-y-1">
                <p className="text-[9px] text-red-300">Are you sure? This cannot be undone.</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => void eraseFlash()}
                    className="flex-1 rounded-lg bg-red-700 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-white"
                  >
                    Confirm Erase
                  </button>
                  <button
                    onClick={() => setEraseConfirming(false)}
                    className="flex-1 rounded-lg bg-slate-700 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* GPS Tab */}
        {activeTab === "gps" && (
          <div className="text-[9px] text-slate-400">
            <p>GPS/NMEA support coming soon (not yet supported by firmware)</p>
          </div>
        )}

        {/* Message Display */}
        {usbMessage && (
          <p className="mt-2 text-[9px] text-slate-300 line-clamp-2 bg-slate-800/50 p-1 rounded">
            {usbMessage}
          </p>
        )}
      </div>

      <pre className="rounded-lg border border-white/8 bg-black/30 p-1.5 text-[9px] text-slate-200 overflow-auto h-[140px] col-span-full">
        {telemetry.packet ? JSON.stringify(telemetry.packet.raw, null, 2) : "No packet."}
      </pre>
    </div>
  );
}

function ConfigEditor({
  config,
  onSave,
}: {
  config: UsbConfigPayload;
  onSave: (nickname: string, callsign: string, id: number) => Promise<void>;
}) {
  const [nickname, setNickname] = useState(config.nickname);
  const [callsign, setCallsign] = useState(config.callsign);
  const [id, setId] = useState(config.id.toString());
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(nickname, callsign, parseInt(id, 10));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 text-[9px]">
      <div>
        <label className="block text-slate-400 mb-1">Nickname (max 32 chars)</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={32}
          className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1 text-slate-100 outline-none"
        />
      </div>
      <div>
        <label className="block text-slate-400 mb-1">Callsign (max 8 chars)</label>
        <input
          type="text"
          value={callsign}
          onChange={(e) => setCallsign(e.target.value)}
          maxLength={8}
          className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1 text-slate-100 outline-none"
        />
      </div>
      <div>
        <label className="block text-slate-400 mb-1">ID (0-65535)</label>
        <input
          type="number"
          value={id}
          onChange={(e) => setId(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1 text-slate-100 outline-none"
        />
      </div>
      <button
        onClick={() => void handleSave()}
        disabled={saving}
        className="w-full rounded-lg bg-cyan-300 px-2 py-1 font-mono uppercase tracking-[0.2em] text-slate-950 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Config"}
      </button>
    </div>
  );
}

function formatMaybeNumber(value: number | null | undefined, unit: string) {
  return typeof value === "number" ? `${value.toFixed(1)} ${unit}` : "--";
}
