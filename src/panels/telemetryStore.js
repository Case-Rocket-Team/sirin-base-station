// telemetryStore.js
export const telemetryData = { latestPacket: null };
const listeners = new Set();

// Called by React when a new packet arrives
export function setLatestPacket(packet) {
  telemetryData.latestPacket = packet;
  listeners.forEach((cb) => cb(packet)); // notify all subscribers
}

// JS files can subscribe to updates
export function subscribeTelemetry(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback); // unsubscribe
}