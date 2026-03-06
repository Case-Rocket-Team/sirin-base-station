// altitude-bar.js
export function createAltitudeBar(containerId, rocketImagePath = "./images/RealRocket.jpg") {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container with id "${containerId}" not found`);
    return;
  }

  // ── Inject font + styles ───────────────────────────────────────────────────
  if (!document.getElementById("altitude-bar-style")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;600;700&family=Orbitron:wght@400;700;900&display=swap";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.id = "altitude-bar-style";
    style.textContent = `
      .altitude-container {
        position: relative;
        width: 64px;
        height: 100%;
        background: linear-gradient(180deg, rgba(10,14,20,0.97) 0%, rgba(6,9,14,1) 100%);
        border: 1px solid rgba(255,255,255,0.10);
        display: flex;
        flex-direction: column-reverse;
        align-items: center;
        padding-bottom: 10px;
        margin: 0 auto;
        overflow: visible;
        box-sizing: border-box;
      }

      /* Left accent line */
      .altitude-container::before {
        content: '';
        position: absolute;
        top: 0; bottom: 0; left: 0;
        width: 1px;
        background: linear-gradient(180deg,
          transparent 0%,
          rgba(80,160,255,0.3) 15%,
          rgba(80,160,255,0.8) 50%,
          rgba(80,160,255,0.3) 85%,
          transparent 100%
        );
      }

      .marker {
        position: absolute;
        width: 100%;
        text-align: right;
        padding-right: 6px;
        font-family: 'Rajdhani', sans-serif;
        font-weight: 600;
        font-size: 10px;
        letter-spacing: 1.5px;
        color: rgba(160,200,255,0.75);
        text-transform: uppercase;
        white-space: nowrap;
      }

      /* Tick mark on the left edge of each marker */
      .marker::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 6px;
        height: 1px;
        background: rgba(80,160,255,0.5);
      }

      .rocket {
        position: absolute;
        width: 90px;
        transition: bottom 0.2s ease-out;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2;
        filter: drop-shadow(0 0 6px rgba(80,160,255,0.4));
      }

      .bar-fill {
        position: absolute;
        bottom: 0;
        width: 100%;
        background: linear-gradient(to top,
          rgba(174,9,0,0.9) 0%,
          rgba(222,204,2,0.85) 60%,
          rgba(80,160,255,0.7) 100%
        );
        box-shadow: 0 0 10px rgba(80,160,255,0.25);
      }

      /* Label at the top */
      .altitude-label {
        position: absolute;
        top: 8px;
        width: 100%;
        text-align: center;
        font-family: 'Orbitron', monospace;
        font-weight: 700;
        font-size: 7px;
        letter-spacing: 2px;
        color: rgba(160,200,255,0.7);
        text-transform: uppercase;
        z-index: 3;
      }
    `;
    document.head.appendChild(style);
  }

  // ── Insert HTML ────────────────────────────────────────────────────────────
  container.innerHTML = `
    <div class="altitude-container">
      <div class="bar-fill"></div>
      <img src="${rocketImagePath}" alt="Rocket" class="rocket">
      <div class="altitude-label">ALT</div>
      <div class="marker" style="bottom: 25%;">10k ft</div>
      <div class="marker" style="bottom: 50%;">20k ft</div>
      <div class="marker" style="bottom: 75%;">30k ft</div>
    </div>
  `;

  const rocket           = container.querySelector(".rocket");
  const barFill          = container.querySelector(".bar-fill");
  const altitudeContainer = container.querySelector(".altitude-container");

  const maxAltitude = 12144; // ~40k ft in meters

  function updatePositions(altMeters) {
    const containerHeight = altitudeContainer.offsetHeight;
    const alt = Math.min(Math.max(altMeters, 0), maxAltitude);
    const percent = alt / maxAltitude;
    rocket.style.bottom = percent * containerHeight - rocket.offsetHeight / 2 + "px";
    barFill.style.height = percent * containerHeight + "px";
  }

  let currentAltitude = 0;

  const resizeObserver = new ResizeObserver(() => {
    updatePositions(currentAltitude);
  });
  resizeObserver.observe(altitudeContainer);

  return function updateAltitude(altMeters) {
    currentAltitude = altMeters;
    updatePositions(altMeters);
  };
}