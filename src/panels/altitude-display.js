// altitude-display.js
export function createAltitudeDisplay(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container with id "${containerId}" not found`);
    return;
  }

  const METERS_TO_FEET = 3.28084;

  container.innerHTML = `
    <div class="alt-display-box">
      <div class="alt-display-label">ALTITUDE</div>
      <div class="alt-display-value">
        <span class="alt-display-number">0</span>
        <span class="alt-display-unit">ft</span>
      </div>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    .alt-display-box {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border: 2px solid #00e5ff;
      border-radius: 6px;
      background: #0d1117;
      padding: 10px 20px;
      min-width: 160px;
      box-shadow: 0 0 8px rgba(0, 229, 255, 0.3), inset 0 0 8px rgba(0, 229, 255, 0.05);
      font-family: 'Courier New', Courier, monospace;
    }

    .alt-display-label {
      font-size: 10px;
      letter-spacing: 3px;
      color: #00e5ff;
      text-transform: uppercase;
      margin-bottom: 4px;
      opacity: 0.8;
    }

    .alt-display-value {
      display: flex;
      align-items: baseline;
      gap: 4px;
    }

    .alt-display-number {
      font-size: 28px;
      font-weight: bold;
      color: #ffffff;
      letter-spacing: 1px;
      transition: color 0.2s ease;
    }

    .alt-display-unit {
      font-size: 13px;
      color: #00e5ff;
      opacity: 0.7;
    }

    .alt-display-number.updated {
      color: #00e5ff;
    }
  `;
  document.head.appendChild(style);

  const numberEl = container.querySelector(".alt-display-number");

  return function updateAltitudeDisplay(altMeters) {
    const feet = altMeters * METERS_TO_FEET;
    numberEl.textContent = Math.round(feet).toLocaleString("en-US");

    // Brief flash on update
    numberEl.classList.add("updated");
    setTimeout(() => numberEl.classList.remove("updated"), 150);
  };
}
