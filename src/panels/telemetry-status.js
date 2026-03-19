// telemetry-status.js
// Small HUD panel showing packet reception stats.
//
// Usage:
//   const status = createTelemetryStatus("my-container-id");
//   status.onPacket();   // call every time a packet arrives
//   status.remove();

export function createTelemetryStatus(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container with id "${containerId}" not found`);
    return { onPacket: () => {}, remove: () => {} };
  }

  // ── Inject styles (shared font already loaded by telemetry-bar) ──────────
  if (!document.getElementById("telemetry-status-style")) {
    const style = document.createElement("style");
    style.id = "telemetry-status-style";
    style.textContent = `
      .ts-panel {
        width: 100%;
        height: 100%;
        background: linear-gradient(180deg, rgba(10,14,20,0.97) 0%, rgba(6,9,14,1) 100%);
        border: 1px solid rgba(80,160,255,0.25);
        box-sizing: border-box;
        padding: 10px 16px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 8px;
        position: relative;
        overflow: hidden;
      }
      .ts-panel::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 1px;
        background: linear-gradient(90deg,
          transparent 0%,
          rgba(80,160,255,0.6) 50%,
          transparent 100%
        );
      }
      .ts-header {
        font-family: 'Orbitron', monospace;
        font-weight: 700;
        font-size: 9px;
        letter-spacing: 3px;
        color: rgba(160,200,255,0.7);
        text-transform: uppercase;
        margin-bottom: 2px;
      }
      .ts-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        padding-bottom: 5px;
      }
      .ts-row:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }
      .ts-label {
        font-family: 'Rajdhani', sans-serif;
        font-weight: 600;
        font-size: 11px;
        letter-spacing: 2px;
        color: rgba(160,200,255,0.75);
        text-transform: uppercase;
      }
      .ts-value {
        font-family: 'Orbitron', monospace;
        font-weight: 700;
        font-size: 15px;
        color: #ffffff;
        letter-spacing: 1px;
        text-shadow: 0 0 8px rgba(100,180,255,0.4);
      }
      .ts-unit {
        font-family: 'Rajdhani', sans-serif;
        font-size: 10px;
        color: rgba(160,200,255,0.6);
        margin-left: 4px;
        letter-spacing: 1px;
      }
      .ts-value.ts-good  { color: #4ade80; text-shadow: 0 0 8px rgba(74,222,128,0.4); }
      .ts-value.ts-warn  { color: #facc15; text-shadow: 0 0 8px rgba(250,204,21,0.4); }
      .ts-value.ts-bad   { color: #f87171; text-shadow: 0 0 8px rgba(248,113,113,0.4); }
    `;
    document.head.appendChild(style);
  }

  // ── Build DOM ─────────────────────────────────────────────────────────────
  const panel = document.createElement("div");
  panel.className = "ts-panel";
  panel.innerHTML = `
    <div class="ts-header">Link Status</div>

    <div class="ts-row">
      <span class="ts-label">Packet Rate</span>
      <span>
        <span class="ts-value" id="ts-rate">---</span>
        <span class="ts-unit">pkt/s</span>
      </span>
    </div>

    <div class="ts-row">
      <span class="ts-label">Last Packet</span>
      <span>
        <span class="ts-value" id="ts-last">---</span>
        <span class="ts-unit">ms ago</span>
      </span>
    </div>

    <div class="ts-row">
      <span class="ts-label">Total Received</span>
      <span>
        <span class="ts-value" id="ts-total">0</span>
        <span class="ts-unit">pkts</span>
      </span>
    </div>

    <div class="ts-row">
      <span class="ts-label">Signal</span>
      <span class="ts-value" id="ts-signal">NO LINK</span>
    </div>

    <div class="ts-row">
      <span class="ts-label">Satellite Count</span>
      <span class="ts-value" id="ts-satcount">0</span>
    </div>
  `;
  container.appendChild(panel);

  const rateEl   = panel.querySelector("#ts-rate");
  const lastEl   = panel.querySelector("#ts-last");
  const totalEl  = panel.querySelector("#ts-total");
  const signalEl = panel.querySelector("#ts-signal");
  const satcountEl = panel.querySelector("#ts-satcount");

  // ── State ─────────────────────────────────────────────────────────────────
  let totalPackets = 0;
  let lastPacketTime = null;
  let packetCount = 0;
  let currentRate = 0;
  let satCount = 0;

  // Update rate every second
  const rateInterval = setInterval(() => {
    currentRate = packetCount;
    packetCount = 0;
    rateEl.textContent = currentRate.toString();

    // Color code rate
    rateEl.className = "ts-value " + (
      currentRate >= 4 ? "ts-good" :
      currentRate >= 1 ? "ts-warn" :
      "ts-bad"
    );

    // Signal quality string
    if (lastPacketTime === null) {
      signalEl.textContent = "NO LINK";
      signalEl.className = "ts-value ts-bad";
    } else if (currentRate >= 4) {
      signalEl.textContent = "GOOD";
      signalEl.className = "ts-value ts-good";
    } else if (currentRate >= 1) {
      signalEl.textContent = "WEAK";
      signalEl.className = "ts-value ts-warn";
    } else {
      signalEl.textContent = "LOST";
      signalEl.className = "ts-value ts-bad";
    }
  }, 1000);

  // Update "last packet" age every 100ms
  const ageInterval = setInterval(() => {
    if (lastPacketTime === null) {
      lastEl.textContent = "---";
      lastEl.className = "ts-value ts-bad";
      return;
    }
    const age = Date.now() - lastPacketTime;
    lastEl.textContent = age.toString();
    lastEl.className = "ts-value " + (
      age < 500  ? "ts-good" :
      age < 2000 ? "ts-warn" :
      "ts-bad"
    );
  }, 100);

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    onPacket(satellites) {
      totalPackets++;
      packetCount++;
      lastPacketTime = Date.now();
      totalEl.textContent = totalPackets.toLocaleString("en-US");
      satcountEl.textContent = satellites;
    },
    remove() {
      clearInterval(rateInterval);
      clearInterval(ageInterval);
      panel.remove();
    }
  };
}