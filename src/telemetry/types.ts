export type TelemetrySource = "lora" | "usb";
export type AppPage = "overview" | "raw" | "timeline" | "replay" | "recovery" | "usb" | "settings";
export type LinkState = "disconnected" | "connecting" | "connected" | "error";
export type RecordingFormat = "csv" | "jsonl";
export type TimelineStage = "standby" | "launch" | "burnout" | "apogee" | "drogue" | "main" | "landed";

export type PacketFields = {
  flightMode: string | null;
  altitudeAglFt: number | null;
  expectedApogeeFt: number | null;
  speedMps: number | null;
  accelTotalG: number | null;
  gpsSatelliteCount: number | null;
  latitudeDeg: number | null;
  longitudeDeg: number | null;
  positionXM: number | null;
  positionYM: number | null;
  positionZM: number | null;
  quatW: number | null;
  quatX: number | null;
  quatY: number | null;
  quatZ: number | null;
};

export type SirinPacket = {
  source: "lora" | "usb" | "replay";
  receivedAtMs: number;
  sequence: number;
  callsign: string | null;
  valid: boolean;
  raw: unknown;
  fields: PacketFields;
};

export type LinkStatus = {
  source: "lora" | "usb" | "replay";
  state: LinkState;
  message: string | null;
  connected: boolean;
  deviceDetected: boolean;
  packetCount: number;
  rejectedPacketCount: number;
  droppedPacketCount: number;
  packetsPerSecond: number;
  lastPacketAtMs: number | null;
  firstPacketAtMs: number | null;
  updatedAtMs: number;
};

export type AppConfig = {
  loraWebsocketUrl: string;
  expectedPacketsPerSecond: number;
  staleTimeoutMs: number;
  targetAltitudeFt: number;
  altitudeMinFt: number;
  altitudeMaxFt: number;
  recordingDirectory: string;
  defaultRecordingFormat: RecordingFormat;
  loraDemodPath: string;
  loraDemodHost: string;
  loraDemodPort: number;
};

export type RecordingStatus = {
  active: boolean;
  source: "lora" | "usb" | "replay" | null;
  format: RecordingFormat | null;
  filename: string | null;
  path: string | null;
  packetsWritten: number;
  startedAtMs: number | null;
  lastError: string | null;
};

export type TimelineState = {
  currentStage: TimelineStage;
  stageStartedAtMs: number;
  completedStages: TimelineStage[];
  lastUpdateMs: number;
  message: string;
};

export type ReplayStatus = {
  loaded: boolean;
  playing: boolean;
  sourcePath: string | null;
  packetCount: number;
  currentIndex: number;
  speed: number;
  currentTimestampMs: number | null;
  lastError: string | null;
};

export type DemodStatus = {
  running: boolean;
  path: string;
  host: string;
  port: number;
  lastError: string | null;
};

export type UsbDeviceInfo = {
  vendorId: number;
  productId: number;
  busNumber: number;
  address: number;
  isSirin: boolean;
  description: string;
};

export type TelemetrySnapshot = {
  loraStatus: LinkStatus;
  usbStatus: LinkStatus;
  latestLoraPacket: SirinPacket | null;
  latestUsbPacket: SirinPacket | null;
  latestReplayPacket: SirinPacket | null;
  config: AppConfig;
  recordingStatus: RecordingStatus;
  timelineState: TimelineState;
  replayStatus: ReplayStatus;
  demodStatus: DemodStatus;
};
