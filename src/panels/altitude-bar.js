import { telemetryData, subscribeTelemetry } from "./telemetryStore.js";

export function createAltitudeBar(containerId, rocketImagePath = "./images/RealRocket.png") {
  const container = document.getElementById(containerId);
  if (!container) return console.error(`Container "${containerId}" not found`);

  container.innerHTML = `
    <div class="altitude-container">
      <div class="bar-fill"></div>
      <div class="altitude-text">0 m</div>
      <img src="${rocketImagePath}" alt="Rocket" class="rocket">
      <div class="marker" style="bottom: 30%;">1k ft</div>
      <div class="marker" style="bottom: 60%;">2k ft</div>
      <div class="marker" style="bottom: 90%;">3k ft</div>
    </div>
  `;

  const altitudeContainer = container.querySelector(".altitude-container");
  const rocket = altitudeContainer.querySelector(".rocket");
  const barFill = altitudeContainer.querySelector(".bar-fill");
  const altitudeText = altitudeContainer.querySelector(".altitude-text");
  const maxAltitude = 12144;
  let currentAltitude = 0;

  function updatePositions(altMeters) {
    const containerHeight = altitudeContainer.offsetHeight;
    const alt = Math.min(Math.max(altMeters, 0), maxAltitude);
    const percent = alt / maxAltitude;
    rocket.style.bottom = `${percent * containerHeight - rocket.offsetHeight / 2}px`;
    barFill.style.height = `${percent * containerHeight}px`;
    altitudeText.innerText = `${Math.round(alt)} m`;
  }

  // Subscribe to telemetry updates
  subscribeTelemetry((packet) => {
    const alt = packet?.packet?.LogEntry?.log?.Data?.altitude;
    if (typeof alt === "number") {
      currentAltitude = alt;
      updatePositions(alt);
    }
  });

  // Resize handling
  new ResizeObserver(() => updatePositions(currentAltitude))
    .observe(altitudeContainer);

  return function updateAltitude(altMeters) {
    currentAltitude = altMeters;
    updatePositions(altMeters);
  };
}