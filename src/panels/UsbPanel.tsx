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
    <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      <TelemetryStatus
        source="usb"
        status={telemetry.status}
        packet={telemetry.packet}
        expectedPacketsPerSecond={telemetry.snapshot?.config.expectedPacketsPerSecond ?? 10}
        staleTimeoutMs={telemetry.snapshot?.config.staleTimeoutMs ?? 3000}
      />

      <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-4 backdrop-blur">
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-200/75">
          USB Telemetry Feed
        </p>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-black/25 p-4">
            <h2 className="font-mono text-sm uppercase tracking-[0.25em] text-white">
              Latest Packet Fields
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-200">
              <div>
                <dt className="text-slate-400">Mode</dt>
                <dd>{telemetry.packet?.fields.flightMode ?? "--"}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Altitude</dt>
                <dd>{formatMaybeNumber(telemetry.packet?.fields.altitudeAglFt, "ft")}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Speed</dt>
                <dd>{formatMaybeNumber(telemetry.packet?.fields.speedMps, "m/s")}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Accel</dt>
                <dd>{formatMaybeNumber(telemetry.packet?.fields.accelTotalG, "g")}</dd>
              </div>
            </dl>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/8 bg-black/25 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-slate-400">USB Devices</p>
              <div className="mt-3 space-y-2 text-sm text-slate-200">
                {devices.map((device) => (
                  <button
                    key={`${device.busNumber}-${device.address}`}
                    onClick={() => void handleConnect(`${device.busNumber}:${device.address}`)}
                    className={`block w-full rounded-xl border px-3 py-3 text-left ${device.isSirin ? "border-emerald-400/30 bg-emerald-400/10" : "border-white/10 bg-white/5"}`}
                  >
                    {device.description}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-black/25 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-slate-400">USB Command</p>
              <div className="mt-3 flex gap-2">
                <select
                  value={usbCommand}
                  onChange={(event) => setUsbCommand(event.target.value)}
                  className="flex-1 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-slate-100 outline-none"
                >
                  <option value="tail_on">tail_on</option>
                  <option value="tail_off">tail_off</option>
                </select>
                <button
                  onClick={() => void handleSendCommand()}
                  className="rounded-xl bg-cyan-300 px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] text-slate-950"
                >
                  Send
                </button>
              </div>
              {usbMessage && <p className="mt-3 text-sm text-slate-300">{usbMessage}</p>}
            </div>

            <pre className="max-h-[240px] overflow-auto rounded-2xl border border-white/8 bg-black/30 p-4 text-xs text-slate-200">
              {telemetry.packet ? JSON.stringify(telemetry.packet.raw, null, 2) : "No USB packet received yet."}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}

function formatMaybeNumber(value: number | null | undefined, unit: string) {
  return typeof value === "number" ? `${value.toFixed(1)} ${unit}` : "--";
}
