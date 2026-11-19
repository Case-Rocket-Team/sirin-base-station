export type TelemetrySource = "lora" | "usb";
export type AppPage = "home" | "overview" | "raw" | "replay" | "recovery" | "usb" | "settings";
export type LinkState = "disconnected" | "connecting" | "connected" | "error";
export type RecordingFormat = "csv" | "jsonl";
export type TimelineStage = "standby" | "launch" | "burnout" | "apogee" | "drogue" | "main" | "landed";
export type SirinMode = "standby" | "flight" | "landed";

export type PacketFields = {
  flightMode: string | null;
  altitudeAglFt: number | null;
  expectedApogeeFt: number | null;
  speedMps: number | null;
  accelTotalG: number | null;
  accelXG: number | null;
  accelYG: number | null;
  accelZG: number | null;
  gyroXDps: number | null;
  gyroYDps: number | null;
  gyroZDps: number | null;
  /** Magnetometer counts as sent by the firmware (no unit scale defined). */
  magXRaw: number | null;
  magYRaw: number | null;
  magZRaw: number | null;
  /** High-G IMU counts as sent by the firmware (no unit scale defined). */
  highGXRaw: number | null;
  highGYRaw: number | null;
  highGZRaw: number | null;
  velocityXMps: number | null;
  velocityYMps: number | null;
  velocityZMps: number | null;
  barometricPressurePa: number | null;
  baroTemperatureC: number | null;
  /** Barometric altitude from the sensor data (`data.altitude`), meters. */
  baroAltitudeM: number | null;
  sirinTimeMs: number | null;
  gpsFixType: string | null;
  apoVoltageV: number | null;
  mainVoltageV: number | null;
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

export type UsbConfigPayload = {
  nickname: string;
  callsign: string;
  id: number;
};

export type FlightSummary = {
  index: number;
  dateLabel: string;
  timestampMs: number | null;
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

/**
 * EKF debug packet (`OutPacket::EkfDebug` in sirin-shared). Sent over USB at
 * ~100 Hz and optionally over LoRa. Emitted on `telemetry://usb/ekf-debug` or
 * `telemetry://lora/ekf-debug`. Field names match the Rust serde output.
 * Values are in the filter's own units (ft, rad, gauss). Non-finite floats
 * (NaN/inf) arrive as `null` because JSON can't represent them.
 */
export type Vec3F32 = { x: number; y: number; z: number };

export type EkfSettingsData = {
  /** Accel noise variance, ft²/s⁴ */
  accel_var_f2ps4: number;
  /** Accel bias random-walk variance, ft²/s⁴ per s */
  accel_bias_var_f2ps4: number;
  /** Gyro noise variance, rad²/s² */
  gyro_var_rad2ps2: number;
  /** Gyro bias random-walk variance, rad²/s² per s */
  gyro_bias_var_rad2ps2: number;
  /** Barometer measurement variance, ft² */
  baro_var_ft2: number;
  /** Magnetometer measurement covariance, 3x3 row-major, gauss² */
  magn_covar_gauss2: number[];
  /** Mag bias random-walk variance, gauss² per s */
  magn_bias_var_gauss2: number;
  /** GPS position covariance, 3x3 row-major, ft² */
  gnss_covar_ft2: number[];
};

export type EkfDebug = {
  /** Board uptime in ms, same clock as DataState `data.time` */
  time: number;
  settings: EkfSettingsData;
  /** rad/s, board frame */
  gyro_bias_radps: Vec3F32;
  /** ft/s², board frame */
  accel_bias_fps2: Vec3F32;
  /** gauss, board frame */
  magn_bias_gauss: Vec3F32;
  /**
   * Diagonal of the error-state covariance (variances), 18 entries, x/y/z per block:
   * 0–2 attitude rad², 3–5 velocity ft²/s², 6–8 position ft²,
   * 9–11 gyro bias (rad/s)², 12–14 accel bias (ft/s²)², 15–17 mag bias gauss²
   */
  covar_diag: number[];
};
