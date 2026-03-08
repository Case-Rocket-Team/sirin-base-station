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

// Module-level flag — persists across remounts, prevents double USB claim
let listeningStarted = false;

export default function TelemetryPanel({ goBack }: Props) {
  const [hackrfConnected, setHackrfConnected] = useState<boolean | null>(null);
  const [usbConnected, setUsbConnected] = useState<boolean | null>(null);
  const [packetRate, setPacketRate] = useState<number>(0);

  useEffect(() => {
    listeningStarted = false;

    // Cache latest of each packet type independently
    let lastData: any = null;
    let lastState: any = null;

    const bar = createTelemetryBar("telemetry-bar-container", { title: "SIRIN BASE STATION" });
    const updateAltitude = createAltitudeBar("altitude-bar-container");
    let updateOrientation: ((data: any) => void) | null = null;
    let packetCount = 0;

    createRocketOrientation("rocket-orientation-container").then((fn: any) => {
      updateOrientation = fn;
    });

    // Checks if the HackRF or a USB sirin are connected every 2 seconds
    const poll = async () => {
      try {
        const connected = await invoke<boolean>("check_hackrf");
        setHackrfConnected(connected);
      } catch (e) {
        setHackrfConnected(false);
      }
      try {
        const usb = await invoke<boolean>("check_usb");
        setUsbConnected(usb);
      } catch (e) {
        setUsbConnected(false);
      }
    };
    poll();
    const interval = setInterval(poll, 2000);

    // Packet rate counter — resets every second
    const rateInterval = setInterval(() => {
      setPacketRate(packetCount);
      packetCount = 0;
    }, 1000);

    const onPacket = new Channel();
    onPacket.onmessage = (msg: any) => {
      packetCount++;
      const logEntry = msg.packet?.packet?.LogEntry;
      if (!logEntry) return;

      // Cache whichever type just arrived
      if (logEntry.log?.Data){
        lastData  = logEntry.log.Data;
        //console.log("DATA PACKET:", JSON.stringify(msg, null, 2));
      }
      if (logEntry.log?.State){
        lastState = logEntry.log.State;
        //console.log("STATE PACKET:", JSON.stringify(msg, null, 2));
      }

      // Update altitude/accel from latest Data
      if (lastData) {
        let accelG = null;
        if (lastData.imu.accel.Ok) {
          const { x, y, z } = lastData.imu.accel.Ok;
          accelG = Math.sqrt(x*x + y*y + z*z) / 1_000_000;
        }
        bar.update({ altitude: lastData.altitude, acceleration: accelG });
        updateAltitude(lastData.altitude);
      }

      // Update orientation from latest State 
      if (updateOrientation) {
        const quat = lastState?.nominal?.rotQuaternion;

        // Validate quaternion has real values before using it
        const quatValid = quat &&
          typeof quat.r === "number" && isFinite(quat.r) &&
          typeof quat.x === "number" && isFinite(quat.x) &&
          typeof quat.y === "number" && isFinite(quat.y) &&
          typeof quat.z === "number" && isFinite(quat.z) &&
          (quat.r !== 0 || quat.x !== 0 || quat.y !== 0 || quat.z !== 0); // not all zero

        //console.log("Calling updateOrientation with:", { quatValid, quat, hasLastData: !!lastData });

        console.log("lastData:", !!lastData, "lastState:", !!lastState);
        console.log("accel:", lastData?.imu?.accel?.Ok);
        console.log("gyro:", lastData?.imu?.angular_vel?.Ok);

        if (quatValid) {
          updateOrientation({ quat });
        } else if (lastData) {
          updateOrientation({
            accel: lastData.imu.accel.Ok,
            gyro:  lastData.imu.angular_vel.Ok,
          });
        }
      }
    };

    const onConnMsg = new Channel();
    onConnMsg.onmessage = (msg: any) => {
      console.log("LoRa connection status:", msg);
    };

    const onUsbMsg = new Channel();
    onUsbMsg.onmessage = (msg: any) => {
      console.log("USB connection status:", msg);
    };

    // Auto-detect: try USB first, fall back to LoRa
    const startListening = async () => {
      if (listeningStarted) return;
      listeningStarted = true;

      try {
        const usbAvailable = await invoke<boolean>("check_usb");
        if (usbAvailable) {
          console.log("Sirin USB detected — using USB.");
          invoke("listen_to_usb", { onUsbConnMsg: onUsbMsg, onPacket });
        } else {
          console.log("No USB device — falling back to LoRa.");
          invoke("listen_to_lora", { onLoraConnMsg: onConnMsg, onPacket });
        }
      } catch (e) {
        console.error("Failed to start listening:", e);
        listeningStarted = false;
        invoke("listen_to_lora", { onLoraConnMsg: onConnMsg, onPacket });
      }
    };

    startListening();

    return () => {
      clearInterval(interval);
      clearInterval(rateInterval);
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

      <div className="absolute top-4 right-4 flex flex-col gap-1">
        {/* HackRF status */}
        <div className={`px-3 py-1 rounded text-sm font-mono
          ${hackrfConnected === null ? "bg-gray-300 text-gray-700" :
            hackrfConnected ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
          {hackrfConnected === null ? "Checking HackRF..." :
           hackrfConnected ? "● HackRF Connected" : "● HackRF Not Found"}
        </div>

        {/* Packet rate sub-status — only show when HackRF is connected */}
        {hackrfConnected && (
          <div className={`px-2 py-0.5 rounded text-xs font-mono text-center
            ${packetRate >= 4 ? "bg-green-900 text-green-300" :
              packetRate > 0  ? "bg-yellow-900 text-yellow-300" :
                                "bg-red-900 text-red-300"}`}>
            {packetRate >= 4
              ? `▲ ${packetRate}/s — Good signal`
              : packetRate > 0
              ? `▲ ${packetRate}/s — Weak signal`
              : `✕ 0/s — No packets`}
          </div>
        )}

        {/* USB status */}
        <div className={`px-3 py-1 rounded text-sm font-mono
          ${usbConnected === null ? "bg-gray-300 text-gray-700" :
            usbConnected ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
          {usbConnected === null ? "Checking USB..." :
           usbConnected ? "● Sirin Connected" : "● Sirin Not Found"}
        </div>
      </div>

      <Window x={5} y={10} width={10} height={70}>
        <div id="altitude-bar-container" className="h-full w-full"></div>
      </Window>

      <Window x={75} y={50} width={20} height={40}>
        <div className="h-full flex items-center justify-center text-gray-400">
          {/*
          <img src="./images/Dhruv.jpg" style={{ width: "100%", height: "100%", objectFit: "fill" }} />
          */}
        </div>
      </Window>

      <Window x={40} y={45} width={30} height={30}>
        <div className="h-full flex items-center justify-center text-gray-400">
          {/*
          <img src="./images/Dhruv.jpg" style={{ width: "100%", height: "100%", objectFit: "fill" }} />
          */}
        </div>
      </Window>

      <Window x={20} y={5} width={60} height={60}>
        <div id="rocket-orientation-container" className="h-full w-full" />
      </Window>

      <Window x={80} y={15} width={15} height={20}>
        <div className="h-full flex items-center justify-center">
          <div style={{
            borderRadius: "50%",
            border: "4px solid #00d5ed",
            padding: "4px",
            display: "inline-flex",
            boxShadow: "0 0 12px rgba(0,229,255,0.4)",
          }}>
            <img
              src="./images/CRT.jpg"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: "50%",
                display: "block",
              }}
            />
          </div>
        </div>
      </Window>

      <Window x={0} y={90} width={100} height={10}>
        <div id="telemetry-bar-container" className="h-full w-full" />
      </Window>
    </main>
  );
}