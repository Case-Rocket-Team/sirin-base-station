import { useEffect, useState } from "react";
import { invoke, Channel } from "@tauri-apps/api/core";
import Window from "../panels/Window";

type Props = {
  goBack: () => void;
};

interface SirinDataState {
  altitude: number | null;
  apogee: number | null;
  pos: { x: number; y: number; z: number } | null;
  vel: { x: number; y: number; z: number } | null;
  rot_quaternion: { r: number; x: number; y: number; z: number } | null;
  gps_fix: {
    itow: number;
    satellites: number;
    fix_type: string;
    pos_acc: number;
    vel_acc: number;
    pos_dop: number;
    lat: number;
    lon: number;
  } | null;
  data: {
    time: number | null;
    altitude: number | null;
    baro: {
      pressure: number | null;
      temperature: number | null;
    } | null;
    imu: {
      accel: { x: number; y: number; z: number } | null;
      angular_vel: { x: number; y: number; z: number } | null;
    } | null;
    high_g_imu: {
      accel: { x: number; y: number; z: number } | null;
    } | null;
    magnetometer: {
        mag: {x: number; y: number; z: number} | null,
    } | null;
  } | null;
}

const EMPTY: SirinDataState = {
  altitude: null, apogee: null, pos: null, vel: null,
  rot_quaternion: null, gps_fix: null, data: null,
};

function resolveOkErr<T>(field: any): T | null {
  if (!field) return null;
  if ("Ok" in field) return field.Ok;
  return null;
}

function fmt(v: number | null | undefined, dec = 2): string {
  if (v === null || v === undefined) return "—";
  return v.toFixed(dec);
}

function Cell({ label, value, unit, warn }: {
  label: string; value: string; unit?: string; warn?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 bg-gray-800 rounded p-3">
      <span className="text-gray-500 text-xs font-mono uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-mono font-medium ${
        warn ? "text-yellow-400" : value === "—" ? "text-gray-600" : "text-gray-100"
      }`}>
        {value}
        {unit && value !== "—"
          ? <span className="text-gray-500 text-xs ml-1">{unit}</span>
          : null}
      </span>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="col-span-full border-b border-gray-700 pb-1 mb-1">
      <span className="text-gray-500 text-xs font-mono uppercase tracking-widest">{title}</span>
    </div>
  );
}

export default function RawDataPanel({ goBack }: Props) {
  const [ds, setDs] = useState<SirinDataState>(EMPTY);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  useEffect(() => {
    const onPacket = new Channel();
    const onLoraConnMsg = new Channel();

    onPacket.onmessage = (msg: any) => {
      const raw = msg.packet?.packet?.LogEntry?.log?.DataState ?? null;
      if (!raw) return;

      setDs({
        altitude:       raw.altitude ?? null,
        apogee:         raw.apogee   ?? null,
        pos:            raw.pos      ?? null,
        vel:            raw.vel      ?? null,
        rot_quaternion: raw.rot_quaternion ?? null,
        gps_fix:        raw.gps_fix  ?? null,
        data: raw.data ? {
          time:     raw.data.time     ?? null,
          altitude: raw.data.altitude ?? null,
          baro: raw.data.baro ? {
            pressure:    resolveOkErr(raw.data.baro.pressure),
            temperature: resolveOkErr(raw.data.baro.temperature),
          } : null,
          imu: raw.data.imu ? {
            accel: resolveOkErr(raw.data.imu.accel),
            angular_vel:  resolveOkErr(raw.data.imu.angular_vel),
          } : null,
          high_g_imu: raw.data.high_g_imu ? {
            accel: resolveOkErr(raw.data.high_g_imu.accel),
          } : null,
          magnetometer: raw.data.magnetometer ? {
            mag: resolveOkErr(raw.data.magnetometer.mag)
          } : null,
        } : null,
      });

      setLastUpdate(Date.now());
    };

    invoke("listen_to_lora", { onLoraConnMsg: onLoraConnMsg, onPacket: onPacket }).catch(console.error);

    return () => {
      invoke("stop_lora").catch(() => {});
    };
  }, []);

  const isStale = lastUpdate !== null && Date.now() - lastUpdate > 3000;

  return (
    <main className="min-h-screen p-6 bg-gray-900 relative">
      <button
        onClick={goBack}
        className="absolute top-4 left-4 px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
      >
        ← Back
      </button>

      <div className="absolute top-4 right-4">
        <div className={`px-3 py-1 rounded text-sm font-mono ${
          lastUpdate === null ? "bg-gray-700 text-gray-400" :
          isStale ? "bg-red-900 text-red-300" : "bg-green-900 text-green-300"
        }`}>
          {lastUpdate === null ? "● Waiting for packets" :
           isStale ? "● Stale" : "● Live"}
        </div>
      </div>

      {/* State */}
      <Window x={0} y={5} width={30} height={22}>
        <div className="grid grid-cols-2 gap-2 p-1 h-full content-start">
          <SectionHeader title="State" />
          <Cell label="Altitude"  value={fmt(ds.altitude)}       unit="m" />
          <Cell label="Apogee"    value={fmt(ds.apogee)}         unit="m" />
          <Cell label="Time"      value={fmt(ds.data?.time, 0)}  unit="ms" />
          <Cell label="Data alt"  value={fmt(ds.data?.altitude)} unit="m" />
        </div>
      </Window>

      {/* Position & Velocity */}
      <Window x={30} y={5} width={35} height={22}>
        <div className="grid grid-cols-3 gap-2 p-1 h-full content-start">
          <SectionHeader title="Position" />
          <Cell label="Pos X" value={fmt(ds.pos?.x)} unit="m" />
          <Cell label="Pos Y" value={fmt(ds.pos?.y)} unit="m" />
          <Cell label="Pos Z" value={fmt(ds.pos?.z)} unit="m" />
          <SectionHeader title="Velocity" />
          <Cell label="Vel X" value={fmt(ds.vel?.x)} unit="m/s" />
          <Cell label="Vel Y" value={fmt(ds.vel?.y)} unit="m/s" />
          <Cell label="Vel Z" value={fmt(ds.vel?.z)} unit="m/s" />
        </div>
      </Window>

      {/* Quaternion */}
      <Window x={65} y={5} width={35} height={22}>
        <div className="grid grid-cols-2 gap-2 p-1 h-full content-start">
          <SectionHeader title="Quaternion" />
          <Cell label="R" value={fmt(ds.rot_quaternion?.r, 4)} />
          <Cell label="X" value={fmt(ds.rot_quaternion?.x, 4)} />
          <Cell label="Y" value={fmt(ds.rot_quaternion?.y, 4)} />
          <Cell label="Z" value={fmt(ds.rot_quaternion?.z, 4)} />
        </div>
      </Window>

      {/* GPS */}
      <Window x={0} y={27} width={50} height={28}>
        <div className="grid grid-cols-3 gap-2 p-1 h-full content-start">
          <SectionHeader title="GPS" />
          <Cell label="Lat"        value={fmt(ds.gps_fix?.lat, 6)}  unit="°" />
          <Cell label="Lon"        value={fmt(ds.gps_fix?.lon, 6)}  unit="°" />
          <Cell label="Satellites" value={String(ds.gps_fix?.satellites ?? "—")}
                warn={(ds.gps_fix?.satellites ?? 99) < 4} />
          <Cell label="Fix type"   value={String(ds.gps_fix?.fix_type ?? "—")} />
          <Cell label="Pos acc"    value={fmt(ds.gps_fix?.pos_acc, 0)} unit="cm" />
          <Cell label="Vel acc"    value={fmt(ds.gps_fix?.vel_acc, 0)} unit="cm" />
          <Cell label="PDOP"       value={fmt(ds.gps_fix?.pos_dop)}
                warn={(ds.gps_fix?.pos_dop ?? 0) > 4} />
          <Cell label="iTOW"       value={fmt(ds.gps_fix?.itow, 0)} unit="ms" />
        </div>
      </Window>

      {/* IMU */}
      <Window x={50} y={27} width={50} height={28}>
        <div className="grid grid-cols-3 gap-2 p-1 h-full content-start">
          <SectionHeader title="IMU — Accel" />
          <Cell label="Accel X" value={fmt(ds.data?.imu?.accel?.x)} unit="µg" />
          <Cell label="Accel Y" value={fmt(ds.data?.imu?.accel?.y)} unit="µg" />
          <Cell label="Accel Z" value={fmt(ds.data?.imu?.accel?.z)} unit="µg" />
          <SectionHeader title="IMU — Gyro" />
          <Cell label="Gyro X"  value={fmt(ds.data?.imu?.angular_vel?.x)}  unit="°/s" />
          <Cell label="Gyro Y"  value={fmt(ds.data?.imu?.angular_vel?.y)}  unit="°/s" />
          <Cell label="Gyro Z"  value={fmt(ds.data?.imu?.angular_vel?.z)}  unit="°/s" />
        </div>
      </Window>

      {/* High-G IMU + Magnetometer */}
      <Window x={0} y={55} width={40} height={25}>
        <div className="grid grid-cols-3 gap-2 p-1 h-full content-start">
          <SectionHeader title="High-G IMU" />
          <Cell label="Accel X" value={fmt(ds.data?.high_g_imu?.accel?.x)} unit="µg" />
          <Cell label="Accel Y" value={fmt(ds.data?.high_g_imu?.accel?.y)} unit="µg" />
          <Cell label="Accel Z" value={fmt(ds.data?.high_g_imu?.accel?.z)} unit="µg" />
          <SectionHeader title="Magnetometer" />
          <Cell label="Mag X"   value={fmt(ds.data?.magnetometer?.mag?.x)} unit="µT" />
          <Cell label="Mag Y"   value={fmt(ds.data?.magnetometer?.mag?.y)} unit="µT" />
          <Cell label="Mag Z"   value={fmt(ds.data?.magnetometer?.mag?.z)} unit="µT" />
        </div>
      </Window>

      {/* Barometer */}
      <Window x={40} y={55} width={60} height={25}>
        <div className="grid grid-cols-3 gap-2 p-1 h-full content-start">
          <SectionHeader title="Barometer" />
          <Cell label="Pressure"    value={fmt(ds.data?.baro?.pressure)}    unit="Pa" />
          <Cell label="Temperature" value={fmt(ds.data?.baro?.temperature)} unit="°C" />
          <Cell label="Altitude"    value={fmt(ds.data?.altitude)}          unit="m" />
        </div>
      </Window>
    </main>
  );
}