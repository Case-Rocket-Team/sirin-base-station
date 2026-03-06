// telemetry-bar.js
// HUD bar displaying live telemetry with title centered.
// Left side:  Velocity | Altitude
// Center:     Mission Title
// Right side: Acceleration | Max Q
//
// Usage:
//   const bar = createTelemetryBar("my-container-id", { title: "SIRIN BASE STATION" });
//   bar.update({ velocity: 120, altitude: 500, acceleration: 1.2, maxQ: 0.0 });
//
// velocity     — ft/s
// altitude     — meters (converted to ft internally)
// acceleration — in Gs
// maxQ         — dynamic pressure, units TBD (displays as-is)

export function createTelemetryBar(containerId, { title = "SIRIN BASE STATION" } = {}) {

  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container with id "${containerId}" not found`);
    return { update: () => {}, remove: () => {} };
  }

  const METERS_TO_FEET = 3.28084;

  // ── Inject font + styles ───────────────────────────────────────────────────
  if (!document.getElementById("telemetry-bar-style")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;600;700&family=Orbitron:wght@400;700;900&display=swap";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.id = "telemetry-bar-style";
    style.textContent = `
      .tb-bar {
        width: 100%;
        height: 100%;
        background: linear-gradient(180deg, rgba(10,14,20,0.97) 0%, rgba(6,9,14,1) 100%);
        border-top: 1px solid rgba(255,255,255,0.10);
        display: flex;
        align-items: stretch;
        overflow: hidden;
        position: relative;
        box-sizing: border-box;
      }
      .tb-bar::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 1px;
        background: linear-gradient(90deg,
          transparent 0%,
          rgba(80,160,255,0.3) 15%,
          rgba(80,160,255,0.8) 50%,
          rgba(80,160,255,0.3) 85%,
          transparent 100%
        );
      }

      /* Left metrics group */
      .tb-left {
        display: flex;
        align-items: stretch;
        flex: 1;
      }

      /* Center title */
      .tb-title {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 36px;
        border-left: 1px solid rgba(255,255,255,0.07);
        border-right: 1px solid rgba(255,255,255,0.07);
        min-width: 260px;
      }
      .tb-title-text {
        font-family: 'Orbitron', monospace;
        font-weight: 900;
        font-size: 12px;
        letter-spacing: 4px;
        color: #ffffff;
        text-transform: uppercase;
        white-space: nowrap;
      }

      /* Right metrics group */
      .tb-right {
        display: flex;
        align-items: stretch;
        flex: 1;
        justify-content: flex-end;
      }

      /* Individual metric cell */
      .tb-metric {
        display: flex;
        align-items: center;
        padding: 0 32px;
        border-right: 1px solid rgba(255,255,255,0.07);
      }
      .tb-metric:first-child {
        border-left: none;
      }
      .tb-right .tb-metric {
        border-right: none;
        border-left: 1px solid rgba(255,255,255,0.07);
      }
      .tb-metric-inner {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 2px;
      }
      .tb-metric-label {
        font-family: 'Rajdhani', sans-serif;
        font-weight: 600;
        font-size: 11px;
        letter-spacing: 2.5px;
        color: rgba(160,200,255,0.85);
        text-transform: uppercase;
        white-space: nowrap;
      }
      .tb-metric-row {
        display: flex;
        align-items: baseline;
        gap: 6px;
      }
      .tb-metric-value {
        font-family: 'Orbitron', monospace;
        font-weight: 700;
        font-size: 26px;
        color: #ffffff;
        letter-spacing: 2px;
        line-height: 1;
        white-space: nowrap;
        text-shadow: 0 0 12px rgba(100,180,255,0.4);
      }
      .tb-metric-unit {
        font-family: 'Rajdhani', sans-serif;
        font-weight: 600;
        font-size: 13px;
        letter-spacing: 1px;
        color: rgba(160,200,255,0.75);
        text-transform: uppercase;
        white-space: nowrap;
        padding-bottom: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  // ── Build DOM ──────────────────────────────────────────────────────────────
  const bar = document.createElement("div");
  bar.className = "tb-bar";
  bar.innerHTML = `
    <!-- Left: Velocity | Altitude -->
    <div class="tb-left">
      <div class="tb-metric">
        <div class="tb-metric-inner">
          <span class="tb-metric-label">Velocity</span>
          <div class="tb-metric-row">
            <span class="tb-metric-value" id="tb-velocity">0,000</span>
            <span class="tb-metric-unit">ft/s</span>
          </div>
        </div>
      </div>
      <div class="tb-metric">
        <div class="tb-metric-inner">
          <span class="tb-metric-label">Altitude</span>
          <div class="tb-metric-row">
            <span class="tb-metric-value" id="tb-altitude">00,000</span>
            <span class="tb-metric-unit">ft</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Center: Title -->
    <div class="tb-title">
      <span class="tb-title-text">${title}</span>
    </div>

    <!-- Right: Acceleration | Max Q -->
    <div class="tb-right">
      <div class="tb-metric">
        <div class="tb-metric-inner">
          <span class="tb-metric-label">Acceleration</span>
          <div class="tb-metric-row">
            <span class="tb-metric-value" id="tb-acceleration">00.000</span>
            <span class="tb-metric-unit">G</span>
          </div>
        </div>
      </div>
      <div class="tb-metric">
        <div class="tb-metric-inner">
          <span class="tb-metric-label">Max Q</span>
          <div class="tb-metric-row">
            <span class="tb-metric-value" id="tb-maxq">---</span>
            <span class="tb-metric-unit">Pa</span>
          </div>
        </div>
      </div>
    </div>
  `;

  container.appendChild(bar);

  // ── Element refs ───────────────────────────────────────────────────────────
  const velEl   = bar.querySelector("#tb-velocity");
  const altEl   = bar.querySelector("#tb-altitude");
  const accelEl = bar.querySelector("#tb-acceleration");
  const maxqEl  = bar.querySelector("#tb-maxq");

  // ── Formatters ─────────────────────────────────────────────────────────────
  function fmtVelocity(v) {
    if (v == null) return "000,000";
    return Math.round(Math.abs(v)).toLocaleString("en-US").padStart(7, "0");
  }

  function fmtAltitude(m) {
    if (m == null) return "000,000";
    const ft = m * METERS_TO_FEET;
    return Math.round(ft).toLocaleString("en-US").padStart(7, "0");
  }

  function fmtAccel(g) {
    if (g == null) return "0.000";
    return Math.abs(g).toFixed(3);
  }

  function fmtMaxQ(q) {
    if (q == null) return "---";
    return Math.round(q).toLocaleString("en-US");
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  // Call with any combination of: { velocity, altitude, acceleration, maxQ }
  return {
    update({ velocity, altitude, acceleration, maxQ } = {}) {
      if (velocity     !== undefined) velEl.textContent   = fmtVelocity(velocity);
      if (altitude     !== undefined) altEl.textContent   = fmtAltitude(altitude);
      if (acceleration !== undefined) accelEl.textContent = fmtAccel(acceleration);
      if (maxQ         !== undefined) maxqEl.textContent  = fmtMaxQ(maxQ);
    },
    remove() {
      bar.remove();
    }
  };
}