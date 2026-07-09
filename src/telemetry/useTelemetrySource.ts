import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  AppConfig,
  DemodStatus,
  LinkStatus,
  RecordingStatus,
  ReplayStatus,
  SirinPacket,
  TelemetrySnapshot,
  TelemetrySource,
  TimelineState,
  UsbDeviceInfo,
} from "./types";

const packetEventBySource = {
  lora: "telemetry://lora/packet",
  usb: "telemetry://usb/packet",
} satisfies Record<TelemetrySource, string>;

const statusEventBySource = {
  lora: "telemetry://lora/status",
  usb: "telemetry://usb/status",
} satisfies Record<TelemetrySource, string>;

export function useTelemetrySource(source: TelemetrySource) {
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot | null>(null);
  const [packet, setPacket] = useState<SirinPacket | null>(null);
  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus | null>(null);
  const [timelineState, setTimelineState] = useState<TimelineState | null>(null);
  const [replayStatus, setReplayStatus] = useState<ReplayStatus | null>(null);
  const [replayPacket, setReplayPacket] = useState<SirinPacket | null>(null);
  const [demodStatus, setDemodStatus] = useState<DemodStatus | null>(null);

  useEffect(() => {
    let mounted = true;
    let packetUnlisten: UnlistenFn | null = null;
    let statusUnlisten: UnlistenFn | null = null;
    let timelineUnlisten: UnlistenFn | null = null;
    let replayStatusUnlisten: UnlistenFn | null = null;
    let replayPacketUnlisten: UnlistenFn | null = null;
    let demodUnlisten: UnlistenFn | null = null;

    invoke<TelemetrySnapshot>("get_telemetry_snapshot")
      .then((nextSnapshot) => {
        if (mounted) {
          applySnapshot(source, nextSnapshot);
        }
      })
      .catch((error) => {
        console.error("Failed to load telemetry snapshot", error);
      });

    void listen<SirinPacket>(packetEventBySource[source], (event) => {
      setPacket(event.payload);
      setSnapshot((current) =>
        current
          ? {
              ...current,
              latestLoraPacket: source === "lora" ? event.payload : current.latestLoraPacket,
              latestUsbPacket: source === "usb" ? event.payload : current.latestUsbPacket,
            }
          : current,
      );
    }).then((unlisten) => {
      packetUnlisten = unlisten;
    });

    void listen<LinkStatus>(statusEventBySource[source], (event) => {
      setStatus(event.payload);
      setSnapshot((current) =>
        current
          ? {
              ...current,
              loraStatus: source === "lora" ? event.payload : current.loraStatus,
              usbStatus: source === "usb" ? event.payload : current.usbStatus,
            }
          : current,
      );
    }).then((unlisten) => {
      statusUnlisten = unlisten;
    });

    void listen<TimelineState>("telemetry://timeline/state", (event) => {
      setTimelineState(event.payload);
      setSnapshot((current) => (current ? { ...current, timelineState: event.payload } : current));
    }).then((unlisten) => {
      timelineUnlisten = unlisten;
    });

    void listen<ReplayStatus>("telemetry://replay/status", (event) => {
      setReplayStatus(event.payload);
      setSnapshot((current) => (current ? { ...current, replayStatus: event.payload } : current));
    }).then((unlisten) => {
      replayStatusUnlisten = unlisten;
    });

    void listen<SirinPacket>("telemetry://replay/packet", (event) => {
      setReplayPacket(event.payload);
      setSnapshot((current) => (current ? { ...current, latestReplayPacket: event.payload } : current));
    }).then((unlisten) => {
      replayPacketUnlisten = unlisten;
    });

    void listen<DemodStatus>("telemetry://demod/status", (event) => {
      setDemodStatus(event.payload);
      setSnapshot((current) => (current ? { ...current, demodStatus: event.payload } : current));
    }).then((unlisten) => {
      demodUnlisten = unlisten;
    });

    return () => {
      mounted = false;
      packetUnlisten?.();
      statusUnlisten?.();
      timelineUnlisten?.();
      replayStatusUnlisten?.();
      replayPacketUnlisten?.();
      demodUnlisten?.();
    };
  }, [source]);

  const applySnapshot = (activeSource: TelemetrySource, nextSnapshot: TelemetrySnapshot) => {
    setSnapshot(nextSnapshot);
    setPacket(activeSource === "lora" ? nextSnapshot.latestLoraPacket : nextSnapshot.latestUsbPacket);
    setStatus(activeSource === "lora" ? nextSnapshot.loraStatus : nextSnapshot.usbStatus);
    setRecordingStatus(nextSnapshot.recordingStatus);
    setTimelineState(nextSnapshot.timelineState);
    setReplayStatus(nextSnapshot.replayStatus);
    setReplayPacket(nextSnapshot.latestReplayPacket);
    setDemodStatus(nextSnapshot.demodStatus);
  };

  const refreshSnapshot = async () => {
    const nextSnapshot = await invoke<TelemetrySnapshot>("get_telemetry_snapshot");
    applySnapshot(source, nextSnapshot);
    return nextSnapshot;
  };

  const getConfig = async () => invoke<AppConfig>("get_config");
  const updateConfig = async (configPatch: AppConfig) => {
    const nextConfig = await invoke<AppConfig>("update_config", { configPatch });
    setSnapshot((current) => (current ? { ...current, config: nextConfig } : current));
    return nextConfig;
  };

  const startRecording = async (request: { source: TelemetrySource; filename: string; format: "csv" | "jsonl" }) => {
    const nextStatus = await invoke<RecordingStatus>("start_recording", { request });
    setRecordingStatus(nextStatus);
    setSnapshot((current) => (current ? { ...current, recordingStatus: nextStatus } : current));
    return nextStatus;
  };

  const stopRecording = async () => {
    const nextStatus = await invoke<RecordingStatus>("stop_recording");
    setRecordingStatus(nextStatus);
    setSnapshot((current) => (current ? { ...current, recordingStatus: nextStatus } : current));
    return nextStatus;
  };

  const loadReplayFile = async (path: string) => invoke<ReplayStatus>("load_replay_file", { request: { path } });
  const startReplay = async (speed: number) => invoke<ReplayStatus>("start_replay", { request: { speed } });
  const pauseReplay = async () => invoke<ReplayStatus>("pause_replay");
  const stepReplay = async () => invoke<ReplayStatus>("step_replay");
  const stopReplay = async () => invoke<ReplayStatus>("stop_replay");
  const getUsbDevices = async () => invoke<UsbDeviceInfo[]>("get_usb_devices");
  const connectUsb = async (deviceId: string) => invoke<string>("connect_usb", { deviceId });
  const disconnectUsb = async () => invoke<string>("disconnect_usb");
  const sendUsbCommand = async (command: string) => invoke<string>("send_usb_command", { request: { command } });
  const getDemodStatus = async () => invoke<DemodStatus>("get_demod_status");
  const startLoraDemod = async () => invoke<DemodStatus>("start_lora_demod");
  const stopLoraDemod = async () => invoke<DemodStatus>("stop_lora_demod");

  return useMemo(
    () => ({
      snapshot,
      packet,
      status,
      recordingStatus,
      timelineState,
      replayStatus,
      replayPacket,
      demodStatus,
      refreshSnapshot,
      getConfig,
      updateConfig,
      startRecording,
      stopRecording,
      loadReplayFile,
      startReplay,
      pauseReplay,
      stepReplay,
      stopReplay,
      getUsbDevices,
      connectUsb,
      disconnectUsb,
      sendUsbCommand,
      getDemodStatus,
      startLoraDemod,
      stopLoraDemod,
    }),
    [demodStatus, packet, recordingStatus, replayPacket, replayStatus, snapshot, source, status, timelineState],
  );
}
