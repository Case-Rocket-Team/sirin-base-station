// position-trace.js
// 3D position trace visualization using Three.js.
// Displays a ground plane, axis scale indicators, a start marker (yellow),
// an end marker (white), and a live trail line tracing the rocket's position.
//
// Auto-scales on every point to keep the entire path in frame.
// Camera is fixed — no mouse interaction.
//
// Usage:
//   const trace = await createPositionTrace("my-container-id");
//   trace.addPoint({ x, y, z });  // call with State.nominal.pos each packet
//   trace.reset();                // clear trail and restart
//   trace.remove();               // cleanup

import * as THREE from "three";

export async function createPositionTrace(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container with id "${containerId}" not found`);
    return { addPoint: () => {}, reset: () => {}, remove: () => {} };
  }
  
  if (!document.getElementById("position-trace-style")) {
    const style = document.createElement("style");
    style.id = "position-trace-style";
    style.textContent = `
      .pt-wrapper {
        width: 100%;
        height: 100%;
        position: relative;
        background: #0a0e14;
        overflow: hidden;
      }
      .pt-canvas {
        display: block;
        width: 100% !important;
        height: 100% !important;
      }
      .pt-overlay {
        position: absolute;
        top: 10px;
        left: 12px;
        pointer-events: none;
      }
      .pt-label {
        font-family: 'Orbitron', monospace;
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 2.5px;
        color: rgba(160,200,255,0.7);
        text-transform: uppercase;
        margin-bottom: 4px;
      }
      .pt-scale {
        font-family: 'Orbitron', monospace;
        font-size: 9px;
        font-weight: 400;
        letter-spacing: 1px;
        color: rgba(100,180,255,0.55);
      }
      .pt-legend {
        position: absolute;
        bottom: 10px;
        left: 12px;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .pt-legend-row {
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: 'Rajdhani', sans-serif;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 1.5px;
        color: rgba(160,200,255,0.6);
        text-transform: uppercase;
      }
      .pt-legend-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .pt-nodata {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Orbitron', monospace;
        font-size: 10px;
        letter-spacing: 3px;
        color: rgba(160,200,255,0.25);
        text-transform: uppercase;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  container.innerHTML = `
    <div class="pt-wrapper" id="${containerId}-wrapper">
      <canvas class="pt-canvas" id="${containerId}-canvas"></canvas>
      <div class="pt-overlay">
        <div class="pt-label">Position Trace</div>
        <div class="pt-scale" id="${containerId}-scale">scale: ---</div>
      </div>
      <div class="pt-legend">
        <div class="pt-legend-row"><div class="pt-legend-dot" style="background:#00e5ff"></div>X axis</div>
        <div class="pt-legend-row"><div class="pt-legend-dot" style="background:#4ade80"></div>Y axis</div>
        <div class="pt-legend-row"><div class="pt-legend-dot" style="background:#f87171"></div>Z axis</div>
        <div class="pt-legend-row"><div class="pt-legend-dot" style="background:#facc15"></div>Start</div>
        <div class="pt-legend-row"><div class="pt-legend-dot" style="background:#ffffff"></div>Current</div>
      </div>
      <div class="pt-nodata" id="${containerId}-nodata">Awaiting position data</div>
    </div>
  `;

  const canvas   = document.getElementById(`${containerId}-canvas`);
  const wrapper  = document.getElementById(`${containerId}-wrapper`);
  const scaleEl  = document.getElementById(`${containerId}-scale`);
  const nodataEl = document.getElementById(`${containerId}-nodata`);

  // ── Renderer ──────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setClearColor(0x0a0e14, 1);
  renderer.setPixelRatio(window.devicePixelRatio);

  // ── Camera — fixed isometric-ish view, never moves ────────────────────────
  const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 100000);
  const CAM_THETA = Math.PI / 4;
  const CAM_PHI   = Math.PI / 3.5;
  const CAM_DIST  = 8;

  function positionCamera(dist) {
    camera.position.set(
      dist * Math.sin(CAM_PHI) * Math.sin(CAM_THETA),
      dist * Math.cos(CAM_PHI),
      dist * Math.sin(CAM_PHI) * Math.cos(CAM_THETA),
    );
    camera.lookAt(0, 0, 0);
  }
  positionCamera(CAM_DIST);

  function resize() {
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(wrapper);
  resize();

  //Lighting 
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0x8ab4f8, 0.7);
  sun.position.set(5, 8, 5);
  scene.add(sun);

  //Ground plane
  const planeMat = new THREE.MeshBasicMaterial({
    color: 0x0d1520,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });
  const planeMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), planeMat);
  planeMesh.rotation.x = -Math.PI / 2;
  scene.add(planeMesh);

  //Grid
  let gridHelper = null;
  function rebuildGrid(size) {
    if (gridHelper) scene.remove(gridHelper);
    gridHelper = new THREE.GridHelper(size, 10, 0x0f2a3a, 0x0f2a3a);
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.9;
    scene.add(gridHelper);
    planeMesh.scale.set(size, size, size);
  }
  rebuildGrid(10);

  //Axis arrows
  let axisGroup = new THREE.Group();
  scene.add(axisGroup);

  function rebuildAxes(len) {
    while (axisGroup.children.length) axisGroup.remove(axisGroup.children[0]);
    const axes = [
      { dir: [1, 0, 0], color: 0x00e5ff },
      { dir: [0, 1, 0], color: 0x4ade80 },
      { dir: [0, 0, 1], color: 0xf87171 },
    ];
    axes.forEach(({ dir, color }) => {
      const mat = new THREE.LineBasicMaterial({ color });
      const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(...dir).multiplyScalar(len)];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      axisGroup.add(new THREE.Line(geo, mat));
    });
  }
  rebuildAxes(1.5);

  //Scale
  let scaleBarGroup = null;
  function rebuildScaleBar(worldLen, labelMeters) {
    if (scaleBarGroup) { scene.remove(scaleBarGroup); }
    scaleBarGroup = new THREE.Group();
    const offset = -4.5;
    scaleBarGroup.position.set(offset, 0.01, offset);
    const mat = new THREE.LineBasicMaterial({ color: 0x4488cc, transparent: true, opacity: 0.9 });
    const linePts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(worldLen, 0, 0)];
    scaleBarGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePts), mat));
    [[0], [worldLen]].forEach(([x]) => {
      const tp = [new THREE.Vector3(x, 0, -0.1), new THREE.Vector3(x, 0, 0.1)];
      scaleBarGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(tp), mat));
    });
    scene.add(scaleBarGroup);

    const label = labelMeters >= 1000
      ? `scale: ${(labelMeters / 1000).toFixed(labelMeters >= 10000 ? 0 : 1)} km / bar`
      : labelMeters >= 1
      ? `scale: ${Math.round(labelMeters)} m / bar`
      : `scale: ${(labelMeters * 100).toFixed(0)} cm / bar`;
    scaleEl.textContent = label;
  }

  //Trail and markers state
  let rawPoints   = [];
  let origin      = null;
  let trailLine   = null;
  let startMarker = null;
  let endMarker   = null;

  function niceNumber(x) {
    const candidates = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50,
                        100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000];
    for (const c of candidates) if (c >= x * 0.12) return c;
    return candidates[candidates.length - 1];
  }

  function rebuildScene() {
    if (rawPoints.length === 0) return;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    rawPoints.forEach(p => {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
    });

    const extentX = maxX - minX || 1e-6;
    const extentY = maxY - minY || 1e-6;
    const extentZ = maxZ - minZ || 1e-6;
    const maxExtent = Math.max(extentX, extentY, extentZ);

    const TARGET_WORLD_SIZE = 7.0;
    const scale = TARGET_WORLD_SIZE / maxExtent;

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;

    function toWorld(p) {
      return new THREE.Vector3(
        (p.x - cx) * scale,
        (p.z - cz) * scale,
        (p.y - cy) * scale,
      );
    }

    const gridSize = TARGET_WORLD_SIZE * 1.3;
    rebuildGrid(gridSize);
    rebuildAxes(gridSize * 0.18);

    const scaleMeters = niceNumber(maxExtent * 0.25);
    const scaleWorld  = scaleMeters * scale;
    rebuildScaleBar(scaleWorld, scaleMeters);

    positionCamera(gridSize * 0.85);

    if (trailLine) { scene.remove(trailLine); trailLine.geometry.dispose(); trailLine = null; }

    if (rawPoints.length >= 2) {
      const positions = [];
      const colors    = [];
      rawPoints.forEach((p, i) => {
        const wp = toWorld(p);
        positions.push(wp.x, wp.y, wp.z);
        const t = i / (rawPoints.length - 1);
        colors.push(0.15 + 0.85 * t, 0.35 + 0.65 * t, 0.55 + 0.45 * t);
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute("color",    new THREE.Float32BufferAttribute(colors, 3));
      trailLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true }));
      scene.add(trailLine);
    }

    if (startMarker) { scene.remove(startMarker); startMarker = null; }
    if (rawPoints.length >= 1) {
      const wp  = toWorld(rawPoints[0]);
      const geo = new THREE.SphereGeometry(0.09, 12, 12);
      const mat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      startMarker = new THREE.Mesh(geo, mat);
      startMarker.position.copy(wp);
      const ringGeo = new THREE.RingGeometry(0.11, 0.16, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      startMarker.add(ring);
      scene.add(startMarker);
    }

    if (endMarker) { scene.remove(endMarker); endMarker = null; }
    if (rawPoints.length >= 1) {
      const last = rawPoints[rawPoints.length - 1];
      const wp   = toWorld(last);
      const geo  = new THREE.SphereGeometry(0.09, 12, 12);
      const mat  = new THREE.MeshBasicMaterial({ color: 0xffffff });
      endMarker  = new THREE.Mesh(geo, mat);
      endMarker.position.copy(wp);
      const ringGeo = new THREE.RingGeometry(0.11, 0.16, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      endMarker.add(ring);
      scene.add(endMarker);
    }
  }

  //Animation loop
  let animating = true;
  (function animate() {
    if (!animating) return;
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  })();

  return {
    addPoint(absPos) {
      if (!absPos || absPos.x == null) return;

      if (origin === null) {
        origin = { x: absPos.x, y: absPos.y, z: absPos.z };
        nodataEl.style.display = "none";
      }

      rawPoints.push({
        x: absPos.x - origin.x,
        y: absPos.y - origin.y,
        z: absPos.z - origin.z,
      });

      rebuildScene();
    },

    reset() {
      rawPoints = [];
      origin    = null;
      if (trailLine)   { scene.remove(trailLine);   trailLine.geometry.dispose();   trailLine   = null; }
      if (startMarker) { scene.remove(startMarker); startMarker = null; }
      if (endMarker)   { scene.remove(endMarker);   endMarker   = null; }
      scaleEl.textContent    = "scale: ---";
      nodataEl.style.display = "";
    },

    remove() {
      animating = false;
      renderer.dispose();
      container.innerHTML = "";
    }
  };
}