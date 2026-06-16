import { useState, useEffect } from "react";
import { invoke, Channel } from "@tauri-apps/api/core";

import InitializationPanel from "./panels/InitializationPanel";
import TelemetryPanel from "./panels/TelemetryPanel";
import UsbPanel from "./panels/UsbPanel";
import RawDataPanel from "./panels/RawDataPanel"

function App() {
  const [activePanel, setActivePanel] =
    useState<"init" | "telemetry" | "usb" | "rawData">("init");

  const switchScreen = (panel: "init" | "telemetry" | "usb" | "rawData") => {
    setActivePanel(panel);
  };

  /*useEffect(() => {
    const onLoraConnMsg = new Channel<any>();
    const onPacket = new Channel<any>();

    onLoraConnMsg.onmessage = (msg) => {
      console.log("LoRa connection message:", msg);
    };

    onPacket.onmessage = (msg) => {
      console.log("Packet received:", msg);
      setData(JSON.stringify(msg, null, 4));
    };

    invoke("listen_to_lora", {
      onLoraConnMsg,
      onPacket,
    }).catch((err) => {
      console.error("Error invoking listen_to_lora:", err);
    });
  }, []);*/

  return (
    <>
      {activePanel === "init" && (
        <InitializationPanel switchScreen={switchScreen} />
      )}

      {activePanel === "telemetry" && (
        <TelemetryPanel goBack={() => switchScreen("init")} />
      )}

      {activePanel === "usb" && (
        <UsbPanel goBack={() => switchScreen("init")} />
      )}

      {activePanel === "rawData" && (
        <RawDataPanel goBack={() => switchScreen("init")} />
      )}
    </>
  );
}

export default App;