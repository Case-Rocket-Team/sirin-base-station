// telemetry-bar.js
// HUD bar displaying live telemetry with title centered.
// Left side:  Velocity | Altitude
// Center:     Mission Title + Flight Mode
// Right side: Acceleration | Apogee
//
// Usage:
//   const bar = createTelemetryBar("my-container-id", { title: "SIRIN BASE STATION" });
//   bar.update({ velocity: 120, altitude: 500, acceleration: 1.2, mode: "Standby" });
//
// velocity     — ft/s
// altitude     — meters (converted to ft internally, from State packet)
// acceleration — in Gs
// mode         — "Standby" | "Flight" | "Landed"
// apogee       — tracked automatically as the highest altitude seen

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

      .tb-left {
        display: flex;
        align-items: stretch;
        flex: 1;
      }

      .tb-title {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 0 36px;
        border-left: 1px solid rgba(255,255,255,0.07);
        border-right: 1px solid rgba(255,255,255,0.07);
        min-width: 260px;
        flex-shrink: 0;
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

      /* Flight mode badge */
      .tb-mode {
        font-family: 'Orbitron', monospace;
        font-weight: 700;
        font-size: 9px;
        letter-spacing: 3px;
        text-transform: uppercase;
        padding: 3px 10px;
        border-radius: 3px;
        white-space: nowrap;
        transition: background 0.3s, color 0.3s, box-shadow 0.3s;
      }
      .tb-mode-standby {
        background: rgba(250,204,21,0.15);
        color: #facc15;
        border: 1px solid rgba(250,204,21,0.4);
        box-shadow: 0 0 8px rgba(250,204,21,0.2);
      }
      .tb-mode-flight {
        background: rgba(74,222,128,0.15);
        color: #4ade80;
        border: 1px solid rgba(74,222,128,0.4);
        box-shadow: 0 0 8px rgba(74,222,128,0.3);
      }
      .tb-mode-landed {
        background: rgba(248,113,113,0.15);
        color: #f87171;
        border: 1px solid rgba(248,113,113,0.4);
        box-shadow: 0 0 8px rgba(248,113,113,0.2);
      }
      .tb-mode-unknown {
        background: rgba(160,160,160,0.1);
        color: rgba(160,200,255,0.5);
        border: 1px solid rgba(160,200,255,0.2);
      }

      .tb-right {
        display: flex;
        align-items: stretch;
        flex: 1;
        justify-content: flex-end;
      }

      /* Fixed-width metric cells so numbers never resize the box */
      .tb-metric {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 220px;
        flex-shrink: 0;
        padding: 0 24px;
        border-right: 1px solid rgba(255,255,255,0.07);
        box-sizing: border-box;
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
        width: 100%;
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
      /* Fixed-width value span — number changes never affect layout */
      .tb-metric-value {
        font-family: 'Orbitron', monospace;
        font-weight: 700;
        font-size: 26px;
        color: #ffffff;
        letter-spacing: 2px;
        line-height: 1;
        white-space: nowrap;
        text-shadow: 0 0 12px rgba(100,180,255,0.4);
        display: inline-block;
        width: 150px;
        overflow: hidden;
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
        flex-shrink: 0;
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
            <span class="tb-metric-value" id="tb-velocity">---</span>
            <span class="tb-metric-unit">ft/s</span>
          </div>
        </div>
      </div>
      <div class="tb-metric">
        <div class="tb-metric-inner">
          <span class="tb-metric-label">Altitude</span>
          <div class="tb-metric-row">
            <span class="tb-metric-value" id="tb-altitude">---</span>
            <span class="tb-metric-unit">ft</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Center: Title + Mode -->
    <div class="tb-title">
      <span class="tb-title-text">${title}</span>
      <span class="tb-mode tb-mode-unknown" id="tb-mode">● WAITING</span>
    </div>

    <!-- Right: Acceleration | Apogee -->
    <div class="tb-right">
      <div class="tb-metric">
        <div class="tb-metric-inner">
          <span class="tb-metric-label">Acceleration</span>
          <div class="tb-metric-row">
            <span class="tb-metric-value" id="tb-acceleration">---</span>
            <span class="tb-metric-unit">G</span>
          </div>
        </div>
      </div>
      <div class="tb-metric">
        <div class="tb-metric-inner">
          <span class="tb-metric-label">Max Altitude</span>
          <div class="tb-metric-row">
            <span class="tb-metric-value" id="tb-apogee">---</span>
            <span class="tb-metric-unit">ft</span>
          </div>
        </div>
      </div>
    </div>
  `;

  container.appendChild(bar);

  // ── Element refs ───────────────────────────────────────────────────────────
  const velEl    = bar.querySelector("#tb-velocity");
  const altEl    = bar.querySelector("#tb-altitude");
  const accelEl  = bar.querySelector("#tb-acceleration");
  const apogeeEl = bar.querySelector("#tb-apogee");
  const modeEl   = bar.querySelector("#tb-mode");

  // ── Apogee tracking — highest altitude seen from State packets ────────────
  let maxAltitudeFt = null;

  // ── Formatters ─────────────────────────────────────────────────────────────
  function fmtVelocity(v) {
    if (v == null) return "---";
    return Math.round(Math.abs(v)).toLocaleString("en-US");
  }

  function fmtAltitude(m) {
    if (m == null) return "---";
    const ft = m * METERS_TO_FEET;
    return Math.round(ft).toLocaleString("en-US");
  }

  function fmtAccel(g) {
    if (g == null) return "---";
    return Math.abs(g).toFixed(3);
  }

  function fmtApogee(ft) {
    if (ft == null) return "---";
    return Math.round(ft).toLocaleString("en-US");
  }

  function updateMode(mode) {
    modeEl.className = "tb-mode";
    switch (mode) {
      case "Standby":
        modeEl.classList.add("tb-mode-standby");
        modeEl.textContent = "● STANDBY";
        break;
      case "Flight":
        modeEl.classList.add("tb-mode-flight");
        modeEl.textContent = "● FLIGHT";
        break;
      case "Landed":
        modeEl.classList.add("tb-mode-landed");
        modeEl.textContent = "● LANDED";
        break;
      default:
        modeEl.classList.add("tb-mode-unknown");
        modeEl.textContent = "● WAITING";
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    update({ velocity, altitude, acceleration, mode } = {}) {
      if (velocity     !== undefined) velEl.textContent   = fmtVelocity(velocity);
      if (acceleration !== undefined) accelEl.textContent = fmtAccel(acceleration);
      if (mode         !== undefined) updateMode(mode);

      if (altitude !== undefined) {
        altEl.textContent = fmtAltitude(altitude);
        if (altitude != null) {
          const ft = altitude * METERS_TO_FEET;
          if (maxAltitudeFt === null || ft > maxAltitudeFt) {
            maxAltitudeFt = ft;
            apogeeEl.textContent = fmtApogee(maxAltitudeFt);
          }
        }
      }
    },
    remove() {
      bar.remove();
    }
  };
}