import React, { useEffect } from "react";
import Window from "../panels/Window";
// @ts-ignore
import { createAltitudeBar } from "../panels/altitude-bar.js"; // your JS module

type Props = {
  goBack: () => void;
};

export default function TelemetryPanel({ goBack }: Props) {
  useEffect(() => {
    const updateAltitude = createAltitudeBar("altitude-bar-container", "rocket.png");

    // Example live simulation
    let altitude = 0;
    const interval = setInterval(() => {
      altitude += Math.random() * 50;
      updateAltitude(altitude);
    }, 100);

    return () => clearInterval(interval); // cleanup on unmount
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

      {/* Fixed windows */}
      <Window x={50} y={100} width={100} height={400}>
        {/* Container for altitude bar */}
        <div id="altitude-bar-container" className="h-full w-full"></div>
      </Window>

      {/* Other windows with images */}
      <Window x={600} y={350} width={100} height={150}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <img src="./images/ZoeCow.png" style={{ width: "100%", height: "100%", objectFit: "fill" }} />
        </div>
      </Window>

      <Window x={250} y={350} width={300} height={200}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <img src="./images/JaiNana.jpeg" style={{ width: "100%", height: "100%", objectFit: "fill" }} />
        </div>
      </Window>

      <Window x={250} y={100} width={300} height={200}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <img src="./images/TheMay.png" style={{ width: "100%", height: "100%", objectFit: "fill" }} />
        </div>
      </Window>

      <Window x={600} y={75} width={150} height={150}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <img src="./images/CRT.jpg" style={{ width: "100%", height: "100%", objectFit: "fill" }} />
        </div>
      </Window>

    </main>
  );
}