// altitude-bar.js
import { subscribeTelemetry } from "./telemetryStore.js";

export function createAltitudeBar(containerId, rocketImagePath = "./images/RealRocket.png") {
  const container = document.getElementById(containerId);
  if (!container) return console.error(`Container "${containerId}" not found`);

  // --- Create the HTML structure ---
  container.innerHTML = `
    <div class="altitude-container">
      <div class="bar-fill"></div>
      <div class="altitude-text">0 m</div>
      <img src="${rocketImagePath}" alt="Rocket" class="rocket">
      <div class="marker" style="bottom: 30%;">10k ft</div>
      <div class="marker" style="bottom: 60%;">20k ft</div>
      <div class="marker" style="bottom: 90%;">30k ft</div>
    </div>
  `;

  // --- CSS styles ---
  const style = document.createElement("style");
  style.textContent = `
    .altitude-container {
      position: relative;
      width: 60px;
      height: 100%;
      background: #424040;
      border-radius: 10px;
      border: 2px solid #000;
      display: flex;
      flex-direction: column-reverse;
      align-items: center;
      padding-bottom: 10px;
      margin: 20px auto;
      overflow: visible;
    }
    .marker {
      position: absolute;
      width: 100%;
      text-align: right;
      padding-right: 5px;
      font-size: 12px;
      color: #fff;
    }
    .rocket {
      position: absolute;
      width: 100px;
      transition: bottom 0.2s ease-out, width 0.2s ease-out;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2;
    }
    .bar-fill {
      position: absolute;
      bottom: 0;
      width: 100%;
      background: linear-gradient(to top, #ae0900, #decc02);
      border-radius: 10px;
    }
    .altitude-text {
      position: absolute;
      top: -20px;
      width: 100%;
      text-align: center;
      color: #fff;
      font-size: 12px;
      font-weight: bold;
      z-index: 3;
    }
  `;
  document.head.appendChild(style);

  // --- Query elements ---
  const altitudeContainer = container.querySelector(".altitude-container");
  const rocket = altitudeContainer.querySelector(".rocket");
  const barFill = altitudeContainer.querySelector(".bar-fill");
  const altitudeText = altitudeContainer.querySelector(".altitude-text");
  const maxAltitude = 12144; // 40k ft in meters
  let currentAltitude = 0;

  function updatePositions(altMeters) {
    if (!rocket || !barFill || !altitudeText || !altitudeContainer) return;

    const containerHeight = altitudeContainer.offsetHeight;
    if (containerHeight === 0) return;

    const alt = Math.min(Math.max(altMeters, 0), maxAltitude);
    const percent = alt / maxAltitude;

    rocket.style.bottom = `${percent * containerHeight - rocket.offsetHeight / 2}px`;
    barFill.style.height = `${percent * containerHeight}px`;
    altitudeText.innerText = `${Math.round(alt)} m`;
  }

  // --- Handle container resizing ---
  const resizeObserver = new ResizeObserver(() => updatePositions(currentAltitude));
  resizeObserver.observe(altitudeContainer);

  // --- Subscribe to telemetry updates ---
  subscribeTelemetry((packet) => {
    const alt = packet?.packet?.LogEntry?.log?.Data?.altitude;
    if (typeof alt === "number") {
      currentAltitude = alt;
      updatePositions(alt);
    }
  });

  // --- Return manual update function if needed ---
  return function updateAltitude(altMeters) {
    currentAltitude = altMeters;
    updatePositions(altMeters);
  };
}