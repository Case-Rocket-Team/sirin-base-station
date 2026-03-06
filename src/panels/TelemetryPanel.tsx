import React, { useEffect } from "react";
import Window from "../panels/Window";
import { Channel, invoke } from "@tauri-apps/api/core";

// @ts-ignore
import { createAltitudeBar } from "../panels/altitude-bar.js";
// @ts-ignore
import { createAltitudeDisplay } from "../panels/altitude-display.js";
// @ts-ignore
import { createRocketOrientation } from "../panels/rocket-orientation.js";

type Props = {
  goBack: () => void;
};

export default function TelemetryPanel({ goBack }: Props) {
  useEffect(() => {
    const updateAltitude = createAltitudeBar("altitude-bar-container");
    const updateAltitudeDisplay = createAltitudeDisplay("altitude-display-container");
    let updateOrientation: ((data: any) => void) | null = null;

    createRocketOrientation("rocket-orientation-container").then((fn: any) => {
      updateOrientation = fn;
    });


    const onPacket = new Channel();
    onPacket.onmessage = (msg: any) => {
      const logEntry = msg.packet?.packet?.LogEntry;
      const data2 = msg.packet.packet.LogEntry.log.Data;

      if (updateOrientation) {
        updateOrientation({
          mag:   data2.magnetometer.mag.Ok,    // { x, y, z }
          accel: data2.imu.accel.Ok,           // { x, y, z }
        });
      }
      if (!logEntry?.log?.Data) return;

      const data = logEntry.log.Data;
      const altitude = data.altitude;
      updateAltitude(altitude);
      updateAltitudeDisplay(altitude);
    };

    const onConnMsg = new Channel();
    onConnMsg.onmessage = (msg: any) => {
      console.log("LoRa connection status:", msg);
    };

    invoke("listen_to_lora", {
      onLoraConnMsg: onConnMsg,
      onPacket: onPacket,
    });
  }, []);

  return (
    <main className="min-h-screen p-6 bg-gray-50 relative">
      <button
        onClick={goBack}
        className="absolute top-4 left-4 px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
      >
        ← Back
      </button>
      <h1 className="text-3xl font-black text-center mb-6 mt-4">
        Telemetry Dashboard
      </h1>
      <Window x={50} y={100} width={100} height={400}>
        <div id="altitude-bar-container" className="h-full w-full"></div>
      </Window>

      <Window x={50} y={50} width={200} height={80}>
        <div id="altitude-display-container" className="h-full w-full flex items-center justify-center"></div>
      </Window>

      <Window x={600} y={350} width={100} height={150}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <img src="./images/Dhruv.jpg" style={{ width: "100%", height: "100%", objectFit: "fill" }} />
        </div>
      </Window>

      <Window x={250} y={350} width={300} height={200}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <img src="./images/Dhruv.jpg" style={{ width: "100%", height: "100%", objectFit: "fill" }} />
        </div>
      </Window>

      <Window x={250} y={100} width={300} height={200}>
        <div id="rocket-orientation-container" className="h-full w-full" />
      </Window>

      <Window x={600} y={75} width={150} height={150}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <img src="./images/CRT.jpg" style={{ width: "100%", height: "100%", objectFit: "fill" }} />
        </div>
      </Window>
    </main>
  );
}