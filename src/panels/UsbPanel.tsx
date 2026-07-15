import TelemetryStatus from "./TelemetryStatus";
import { useTelemetrySource } from "../telemetry/useTelemetrySource";
import { useEffect, useState } from "react";
import type { UsbDeviceInfo } from "../telemetry/types";

export default function UsbPanel() {
  const telemetry = useTelemetrySource("usb");
  const [devices, setDevices] = useState<UsbDeviceInfo[]>([]);
  const [usbCommand, setUsbCommand] = useState("tail_on");
  const [usbMessage, setUsbMessage] = useState<string | null>(null);

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

  return (
    <div className="responsive-panel-grid responsive-panel-grid-usb">
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

      <div className="rounded-lg border border-white/8 bg-black/25 p-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400">Command</p>
        <div className="mt-1 flex gap-0.5">
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
        {usbMessage && <p className="mt-1 text-[9px] text-slate-300 line-clamp-1">{usbMessage}</p>}
      </div>

      <pre className="rounded-lg border border-white/8 bg-black/30 p-1.5 text-[9px] text-slate-200 overflow-auto h-[140px]">
        {telemetry.packet ? JSON.stringify(telemetry.packet.raw, null, 2) : "No packet."}
      </pre>
    </div>
  );
}

function formatMaybeNumber(value: number | null | undefined, unit: string) {
  return typeof value === "number" ? `${value.toFixed(1)} ${unit}` : "--";
}
