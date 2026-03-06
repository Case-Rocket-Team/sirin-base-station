// altitude-bar.js

export function createAltitudeBar(containerId, rocketImagePath = "./images/RealRocket.jpg") {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container with id "${containerId}" not found`);
    return;
  }

  // Insert altitude bar HTML
  container.innerHTML = `
    <div class="altitude-container">
      <div class="bar-fill"></div>
      <img src="./images/RealRocket.jpg" alt="Rocket" class="rocket">
      <div class="marker" style="bottom: 30%;">10k ft</div>
      <div class="marker" style="bottom: 60%;">20k ft</div>
      <div class="marker" style="bottom: 90%;">30k ft</div>
    </div>
  `;

  // Inject CSS
  const style = document.createElement("style");
  style.textContent = `
    .altitude-container {
      position: relative;
      width: 60px;
      height: 100%; /* fill parent dynamically */
      background: #424040;
      border: 2px solid #000000;
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
      color: #ffffff;
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
    }
  `;
  document.head.appendChild(style);

  const rocket = container.querySelector(".rocket");
  const barFill = container.querySelector(".bar-fill");
  const altitudeContainer = container.querySelector(".altitude-container");
  const maxAltitude = 12144; // 40k ft in meters

  // Internal function to update positions based on current container height
  function updatePositions(altMeters) {
    const containerHeight = altitudeContainer.offsetHeight;
    const alt = Math.min(Math.max(altMeters, 0), maxAltitude);
    const percent = alt / maxAltitude;

    rocket.style.bottom = percent * containerHeight - rocket.offsetHeight / 2 + "px";
    barFill.style.height = percent * containerHeight + "px";
  }

  let currentAltitude = 0;

  // Resizability: watch container size changes
  const resizeObserver = new ResizeObserver(() => {
    updatePositions(currentAltitude);
  });
  resizeObserver.observe(altitudeContainer);

  // Return a function to update altitude
  return function updateAltitude(altMeters) {
    currentAltitude = altMeters;
    updatePositions(altMeters);
  };
}