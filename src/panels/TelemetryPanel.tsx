import React, { useEffect, useState } from "react";
import Window from "../panels/Window";
import { Channel, invoke } from "@tauri-apps/api/core";
// @ts-ignore
import { createAltitudeBar } from "../panels/altitude-bar.js";
// @ts-ignore
import { createRocketOrientation } from "../panels/rocket-orientation.js";
// @ts-ignore
import { createTelemetryBar } from "../panels/telemetry-bar.js";

type Props = {
  goBack: () => void;
};

export default function TelemetryPanel({ goBack }: Props) {
  const [hackrfConnected, setHackrfConnected] = useState<boolean | null>(null); // ← moved inside
  
  useEffect(() => {
    const bar = createTelemetryBar("telemetry-bar-container", { title: "SIRIN BASE STATION" });
    const updateAltitude = createAltitudeBar("altitude-bar-container");
    let updateOrientation: ((data: any) => void) | null = null;

    createRocketOrientation("rocket-orientation-container").then((fn: any) => {
      updateOrientation = fn;
    });

    const poll = async () => {
      try {
        const connected = await invoke<boolean>("check_hackrf");
        setHackrfConnected(connected);
      } catch (e) {
        setHackrfConnected(false);
      }
    };

    poll();
    const interval = setInterval(poll, 2000);

    const onPacket = new Channel();
    onPacket.onmessage = (msg: any) => {
      const logEntry = msg.packet?.packet?.LogEntry;
      if (!logEntry?.log?.Data) return;

      const data = logEntry.log.Data;

      let accelG = null;
      if (data.imu.accel.Ok) {
        const { x, y, z } = data.imu.accel.Ok;
        accelG = Math.sqrt(x*x + y*y + z*z) / 1_000_000;
      }

      bar.update({ altitude: data.altitude, acceleration: accelG });
      updateAltitude(data.altitude);

      if (updateOrientation) {
        updateOrientation({
          accel: data.imu.accel.Ok,
          mag:   data.magnetometer.mag.Ok,
        });
      }
    };

    const onConnMsg = new Channel();
    onConnMsg.onmessage = (msg: any) => {
      console.log("LoRa connection status:", msg);
    };

    invoke("listen_to_lora", {
      onLoraConnMsg: onConnMsg,
      onPacket: onPacket,
    });

    return () => {
      clearInterval(interval);
      bar.remove();
    };
  }, []);

  return (
    <main className="min-h-screen p-6 bg-gray-900 relative">
      <button
        onClick={goBack}
        className="absolute top-4 left-4 px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
      >
        ← Back
      </button>
      <div className={`absolute top-4 right-4 px-3 py-1 rounded text-sm font-mono
        ${hackrfConnected === null ? "bg-gray-300 text-gray-700" :
          hackrfConnected ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
        {hackrfConnected === null ? "Checking HackRF..." :
         hackrfConnected ? "● HackRF Connected" : "● HackRF Not Found"}
      </div>

      <Window x={5}  y={10} width={10}  height={70}>
        <div id="altitude-bar-container" className="h-full w-full"></div>
      </Window>

      <Window x={75} y={50} width={20}  height={40}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <img src="./images/Dhruv.jpg" style={{ width: "100%", height: "100%", objectFit: "fill" }} />
        </div>
      </Window>

      <Window x={30} y={45} width={40} height={40}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <img src="./images/Dhruv.jpg" style={{ width: "100%", height: "100%", objectFit: "fill" }} />
        </div>
      </Window>

      <Window x={30} y={5} width={40} height={40}>
        <div id="rocket-orientation-container" className="h-full w-full" />
      </Window>

      <Window x={80} y={5}  width={20}  height={30}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <img src="./images/CRT.jpg" style={{ width: "100%", height: "100%", objectFit: "fill" }} />
        </div>
      </Window>

      <Window x={0} y={90} width={100} height={10}>
        <div id="telemetry-bar-container" className="h-full w-full" />
      </Window>
    </main>
  );
}