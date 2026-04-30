// apogee-predictor.js
// Shows projected apogee from altitude + vertical velocity.
// Locks to actual apogee once State.apogee is populated.
// Shows ascending/descending indicator if vertical velocity is significant.
//
// Usage:
//   const predictor = createApogeePredictor("my-container-id");
//   predictor.update({ altitude, velX, apogee });
//     altitude — meters (State.altitude)
//     velX     — m/s  (State.nominal.vel.x, vertical component)
//     apogee   — meters or null (State.apogee)

export function createApogeePredictor(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container with id "${containerId}" not found`);
    return { update: () => {}, remove: () => {} };
  }

  const GRAVITY        = 9.80665;
  const METERS_TO_FEET = 3.28084;

  if (!document.getElementById("ap-style")) {
    const style = document.createElement("style");
    style.id = "ap-style";
    style.textContent = `
      .ap-panel {
        width: 100%;
        height: 100%;
        background: linear-gradient(180deg, rgba(10,14,20,0.97) 0%, rgba(6,9,14,1) 100%);
        border: 1px solid rgba(80,160,255,0.25);
        box-sizing: border-box;
        padding: 10px 16px;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        gap: 6px;
        position: relative;
        overflow: hidden;
      }
      .ap-panel::before {
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
      .ap-header {
        font-family: 'Orbitron', monospace;
        font-weight: 700;
        font-size: 9px;
        letter-spacing: 3px;
        color: rgba(160,200,255,0.7);
        text-transform: uppercase;
      }
      .ap-value-row {
        display: flex;
        align-items: baseline;
        gap: 6px;
      }
      .ap-value {
        font-family: 'Orbitron', monospace;
        font-weight: 700;
        font-size: 26px;
        color: #ffffff;
        letter-spacing: 2px;
        line-height: 1;
        text-shadow: 0 0 12px rgba(100,180,255,0.4);
        white-space: nowrap;
      }
      .ap-value.ap-locked {
        color: #4ade80;
        text-shadow: 0 0 12px rgba(74,222,128,0.45);
      }
      .ap-unit {
        font-family: 'Rajdhani', sans-serif;
        font-weight: 600;
        font-size: 13px;
        letter-spacing: 1px;
        color: rgba(160,200,255,0.6);
        text-transform: uppercase;
      }
      .ap-direction {
        font-family: 'Orbitron', monospace;
        font-weight: 700;
        font-size: 9px;
        letter-spacing: 2px;
        text-transform: uppercase;
        padding: 2px 8px;
        border-radius: 3px;
      }
      .ap-direction.ap-ascending {
        background: rgba(74,222,128,0.12);
        color: #4ade80;
        border: 1px solid rgba(74,222,128,0.3);
      }
      .ap-direction.ap-descending {
        background: rgba(248,113,113,0.12);
        color: #f87171;
        border: 1px solid rgba(248,113,113,0.3);
      }
      .ap-direction.ap-hidden {
        visibility: hidden;
      }
    `;
    document.head.appendChild(style);
  }

  const panel = document.createElement("div");
  panel.className = "ap-panel";
  panel.innerHTML = `
    <span class="ap-header" id="ap-header">Projected Apogee</span>
    <div class="ap-value-row">
      <span class="ap-value" id="ap-value">---</span>
      <span class="ap-unit">ft</span>
    </div>
    <span class="ap-direction ap-hidden" id="ap-direction"></span>
  `;
  container.appendChild(panel);

  const headerEl    = panel.querySelector("#ap-header");
  const valueEl     = panel.querySelector("#ap-value");
  const directionEl = panel.querySelector("#ap-direction");

  const VEL_THRESHOLD = 2.0;

  let locked = false;

  function fmt(ft) {
    if (ft == null || !isFinite(ft)) return "---";
    return Math.round(ft).toLocaleString("en-US");
  }

  return {
    update({ altitude, velX, apogee } = {}) {
      if (apogee != null) {
        if (!locked) locked = true;
        headerEl.textContent  = "Apogee";
        valueEl.textContent   = fmt(apogee * METERS_TO_FEET);
        valueEl.className     = "ap-value ap-locked";
        directionEl.className = "ap-direction ap-hidden";
        return;
      }

      if (altitude == null || velX == null) {
        valueEl.textContent   = "---";
        directionEl.className = "ap-direction ap-hidden";
        return;
      }

      const hExtra     = velX > 0 ? (velX * velX) / (2 * GRAVITY) : 0;
      const projectedFt = (altitude + hExtra) * METERS_TO_FEET;

      headerEl.textContent = "Projected Apogee";
      valueEl.textContent  = fmt(projectedFt);
      valueEl.className    = "ap-value";

      if (velX > VEL_THRESHOLD) {
        directionEl.textContent = "▲ Ascending";
        directionEl.className   = "ap-direction ap-ascending";
      } else if (velX < -VEL_THRESHOLD) {
        directionEl.textContent = "▼ Descending";
        directionEl.className   = "ap-direction ap-descending";
      } else {
        directionEl.className = "ap-direction ap-hidden";
      }
    },

    remove() {
      panel.remove();
    }
  };
}