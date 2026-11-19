import { useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { EkfDebug, EkfSettingsData, TelemetrySource, Vec3F32 } from "./types";

const EKF_DEBUG_EVENT_BY_SOURCE = {
  usb: "telemetry://usb/ekf-debug",
  lora: "telemetry://lora/ekf-debug",
} satisfies Record<TelemetrySource, string>;

/** How much history to keep, in board time. */
const WINDOW_MS = 30_000;
/** Hard cap on buffered points (~30 s at 100 Hz). */
const MAX_POINTS = 3000;
/** How often buffered packets are pushed to React. */
const FLUSH_INTERVAL_MS = 100;
/**
 * No packet for this long counts as "no data". USB sends ~100 Hz; radio
 * sends far less often, so it gets more slack before the charts are hidden.
 */
const STALE_AFTER_MS_BY_SOURCE = {
  usb: 1000,
  lora: 5000,
} satisfies Record<TelemetrySource, number>;

const FT_TO_M = 0.3048;
const RAD_TO_DEG = 57.2958;
const FPS2_PER_G = 32.174;
const GAUSS_TO_UT = 100;

type Xyz = [number | null, number | null, number | null];

/** One EKF debug packet, already converted to display units. */
export type EkfPoint = {
  /** Board uptime, seconds */
  t: number;
  gyroBiasDps: Xyz;
  accelBiasMg: Xyz;
  magBiasUt: Xyz;
  /** Standard deviations (sqrt of covariance diagonal) */
  attitudeSigmaDeg: Xyz;
  velocitySigmaMps: Xyz;
  positionSigmaM: Xyz;
  gyroBiasSigmaDps: Xyz;
  accelBiasSigmaMg: Xyz;
  magBiasSigmaUt: Xyz;
};

export type EkfDebugState = {
  points: EkfPoint[];
  settings: EkfSettingsData | null;
  /** True when a packet arrived recently (see STALE_AFTER_MS_BY_SOURCE). */
  live: boolean;
};

const EMPTY: EkfDebugState = { points: [], settings: null, live: false };

/**
 * Listens for EKF debug packets from the selected source (USB or LoRa) and
 * keeps a rolling 30 s buffer.
 * Packets go into a ref and are flushed to state at 10 Hz, so 100 Hz
 * traffic doesn't cause 100 renders per second.
 */
export function useEkfDebug(source: TelemetrySource): EkfDebugState {
  const [state, setState] = useState<EkfDebugState>(EMPTY);
  const buffer = useRef<EkfPoint[]>([]);
  const settings = useRef<EkfSettingsData | null>(null);
  const lastReceivedAt = useRef<number | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    buffer.current = [];
    settings.current = null;
    lastReceivedAt.current = null;
    dirty.current = false;
    setState(EMPTY);

    const staleAfterMs = STALE_AFTER_MS_BY_SOURCE[source];
    let unlisten: UnlistenFn | null = null;
    let cancelled = false;

    void listen<EkfDebug>(EKF_DEBUG_EVENT_BY_SOURCE[source], (event) => {
      const point = toPoint(event.payload);
      const buf = buffer.current;
      const last = buf[buf.length - 1];
      // Board time went backwards: the board rebooted, so old history no longer lines up.
      if (last && point.t < last.t - 1) {
        buf.length = 0;
      }
      buf.push(point);

      const cutoff = point.t - WINDOW_MS / 1000;
      let drop = 0;
      while (drop < buf.length && buf[drop].t < cutoff) drop++;
      drop = Math.max(drop, buf.length - MAX_POINTS);
      if (drop > 0) buf.splice(0, drop);

      settings.current = event.payload.settings;
      lastReceivedAt.current = Date.now();
      dirty.current = true;
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    const timer = window.setInterval(() => {
      const live = lastReceivedAt.current != null && Date.now() - lastReceivedAt.current < staleAfterMs;
      if (dirty.current) {
        dirty.current = false;
        setState({ points: buffer.current.slice(), settings: settings.current, live });
      } else {
        setState((prev) => (prev.live === live ? prev : { ...prev, live }));
      }
    }, FLUSH_INTERVAL_MS);

    return () => {
      cancelled = true;
      unlisten?.();
      window.clearInterval(timer);
    };
  }, [source]);

  return state;
}

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function scaleVec(v: Vec3F32, factor: number): Xyz {
  return [v.x, v.y, v.z].map((c) => {
    const n = finite(c);
    return n == null ? null : n * factor;
  }) as Xyz;
}

/** sqrt of covariance entries [start, start+3), times a unit factor. */
function sigma(diag: number[], start: number, factor: number): Xyz {
  return [0, 1, 2].map((i) => {
    const variance = finite(diag[start + i]);
    // A tiny negative variance can show up from rounding; treat it as zero.
    return variance == null ? null : Math.sqrt(Math.max(variance, 0)) * factor;
  }) as Xyz;
}

function toPoint(packet: EkfDebug): EkfPoint {
  const d = packet.covar_diag ?? [];
  const mgPerFps2 = 1000 / FPS2_PER_G;
  return {
    t: packet.time / 1000,
    gyroBiasDps: scaleVec(packet.gyro_bias_radps, RAD_TO_DEG),
    accelBiasMg: scaleVec(packet.accel_bias_fps2, mgPerFps2),
    magBiasUt: scaleVec(packet.magn_bias_gauss, GAUSS_TO_UT),
    attitudeSigmaDeg: sigma(d, 0, RAD_TO_DEG),
    velocitySigmaMps: sigma(d, 3, FT_TO_M),
    positionSigmaM: sigma(d, 6, FT_TO_M),
    gyroBiasSigmaDps: sigma(d, 9, RAD_TO_DEG),
    accelBiasSigmaMg: sigma(d, 12, mgPerFps2),
    magBiasSigmaUt: sigma(d, 15, GAUSS_TO_UT),
  };
}
