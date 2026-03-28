import { useState, useEffect } from "react";
import { invoke, Channel } from "@tauri-apps/api/core";

import InitializationPanel from "./panels/InitializationPanel";
import TelemetryPanel from "./panels/TelemetryPanel";
import UsbPanel from "./panels/UsbPanel";

function App() {
  const [data, setData] = useState<string>("no data :(");
  const [activePanel, setActivePanel] =
    useState<"init" | "telemetry" | "usb">("init");

  const [message, setMessage] = useState<string>("");

  const switchScreen = (panel: "init" | "telemetry" | "usb") => {
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
    </>
  );
}

export default App;