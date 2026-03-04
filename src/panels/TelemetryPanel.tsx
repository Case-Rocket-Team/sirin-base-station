import React, { useEffect, useState } from "react";
import Window from "../panels/Window";
// @ts-ignore
import { createAltitudeBar } from "../panels/altitude-bar.js";
import { listen } from "@tauri-apps/api/event";
// @ts-ignore
import { setLatestPacket, telemetryData } from "./telemetryStore.js";

type Props = {
  goBack: () => void;
};

// Type for Rust payload
interface LoraPacketRx {
  packet: Record<string, any>;
}

listen("lora-packet", (event) => {
  const packet = event.payload;
  setLatestPacket(packet);
});

export default function TelemetryPanel({ goBack }: Props) {
  const [latestPacket, setLatestPacket] = useState<LoraPacketRx | null>(null);

  useEffect(() => {
    // 1️⃣ Initialize altitude bar
    const updateAltitude = createAltitudeBar(
      "altitude-bar-container",
      "./images/RealRocket.png"
    );

    // 2️⃣ Listen for Lora packets emitted by Rust
    const unlistenPromise = listen<LoraPacketRx>("lora-packet", (event) => {
      const data = event.payload;

      console.log("Received packet from Rust:", data);

      // Update JSON display window
      setLatestPacket(data);

      // Safely extract altitude
      const altitude = data?.packet?.LogEntry?.log?.Data?.altitude;

      if (altitude !== undefined && typeof altitude === "number") {
        console.log("Updating altitude:", altitude);
        updateAltitude(altitude);
      } else {
        console.warn("Altitude not found in packet:", data.packet);
      }
    });

    // 3️⃣ Cleanup listener on unmount
    return () => {
      unlistenPromise.then((f) => f());
    };
  }, []);

  return (
    <main className="min-h-screen p-6 bg-gray-50 relative">
      {/* Back Button */}
      <button
        onClick={goBack}
        className="absolute top-4 left-4 px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
      >
        ← Back
      </button>

      <h1 className="text-3xl font-black text-center mb-6 mt-4">
        Telemetry Dashboard
      </h1>

      {/* Altitude Bar Window */}
      <Window x={50} y={100} width={100} height={400}>
        <div id="altitude-bar-container" className="h-full w-full"></div>
      </Window>

      {/* JSON Display Window */}
      <Window x={250} y={600} width={400} height={400}>
        <div className="h-full p-2 overflow-auto text-xs bg-gray-100 rounded">
          {latestPacket ? (
            <pre>{JSON.stringify(latestPacket.packet, null, 2)}</pre>
          ) : (
            <p className="text-gray-400">Waiting for data...</p>
          )}
        </div>
      </Window>

      {/* Other windows with images */}
      <Window x={600} y={75} width={150} height={150}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <img
            src="./images/CRT.jpg"
            style={{ width: "100%", height: "100%", objectFit: "fill" }}
          />
        </div>
      </Window>

      <Window x={600} y={350} width={100} height={150}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <img
            src="./images/ZoeCow.png"
            style={{ width: "100%", height: "100%", objectFit: "fill" }}
          />
        </div>
      </Window>

      <Window x={250} y={350} width={300} height={200}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <img
            src="./images/JaiNana.jpeg"
            style={{ width: "100%", height: "100%", objectFit: "fill" }}
          />
        </div>
      </Window>

      <Window x={250} y={100} width={300} height={200}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <img
            src="./images/TheMay.png"
            style={{ width: "100%", height: "100%", objectFit: "fill" }}
          />
        </div>
      </Window>
    </main>
  );
}