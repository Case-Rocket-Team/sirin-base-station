// rocket-orientation.js
// Displays a 3D rocket orientation based on magnetometer + accelerometer data.
// Uses Three.js + GLTFLoader (both loaded from CDN if not already present).
//
// Usage:
//   const updateOrientation = await createRocketOrientation("my-container-id");
//   updateOrientation({ mag: { x, y, z }, accel: { x, y, z } });
//
// Place your rocket GLB file at: /models/rocket.glb  (inside your /public folder)

export async function createRocketOrientation(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container with id "${containerId}" not found`);
    return () => {};
  }

  // ── Styles ───────────────────────────────────────────────────────────────────
  if (!document.getElementById("rocket-orientation-style")) {
    const style = document.createElement("style");
    style.id = "rocket-orientation-style";
    style.textContent = `
      .orient-wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .orient-circle {
        position: relative;
        aspect-ratio: 1 / 1;
        height: 100%;
        border-radius: 50%;
        border: 3px solid #000;
        overflow: hidden;
        background: #e8edf2;
        box-shadow: inset 0 2px 10px rgba(0,0,0,0.18), 0 3px 10px rgba(0,0,0,0.25);
      }
      .orient-canvas {
        display: block;
        width: 100% !important;
        height: 100% !important;
      }
    `;
    document.head.appendChild(style);
  }

  container.innerHTML = `
    <div class="orient-wrapper">
      <div class="orient-circle" id="${containerId}-circle">
        <canvas class="orient-canvas" id="${containerId}-canvas"></canvas>
      </div>
    </div>
  `;

  // ── Load Three.js ─────────────────────────────────────────────────────────────
  const THREE = await new Promise((resolve) => {
    if (window.THREE) return resolve(window.THREE);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    s.onload = () => resolve(window.THREE);
    document.head.appendChild(s);
  });

  // ── Load GLTFLoader ───────────────────────────────────────────────────────────
  await new Promise((resolve) => {
    if (THREE.GLTFLoader) return resolve();
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js";
    s.onload = resolve;
    document.head.appendChild(s);
  });

  const canvas = document.getElementById(`${containerId}-canvas`);
  const circle = document.getElementById(`${containerId}-circle`);

  // ── Renderer ──────────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setClearColor(0xe8edf2, 1);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
  camera.position.set(1.5, 1.2, 1.7);
  camera.lookAt(0.5, 0.4, 0.5);

  function resize() {
    const s = circle.clientHeight;
    renderer.setSize(s, s, false);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(circle);

  // ── Scene ─────────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();

  // ── Lighting ──────────────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xffffff, 0.65));

  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(3, 5, 4);
  sun.castShadow = true;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xaaccff, 0.3);
  fill.position.set(-2, 1, -2);
  scene.add(fill);

  // ── Grid planes (positive octant only) ───────────────────────────────────────
  const GRID_SIZE = 1.0;
  const GRID_DIVS = 5;
  const step = GRID_SIZE / GRID_DIVS;

  function buildGrid(plane, color) {
    const pts = [];
    for (let i = 0; i <= GRID_DIVS; i++) {
      const t = i * step;
      if (plane === "XY") {
        pts.push(t, 0, 0,   t, GRID_SIZE, 0);
        pts.push(0, t, 0,   GRID_SIZE, t, 0);
      } else if (plane === "XZ") {
        pts.push(t, 0, 0,   t, 0, GRID_SIZE);
        pts.push(0, 0, t,   GRID_SIZE, 0, t);
      } else { // YZ
        pts.push(0, t, 0,   0, t, GRID_SIZE);
        pts.push(0, 0, t,   0, GRID_SIZE, t);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 });
    return new THREE.LineSegments(geo, mat);
  }

  scene.add(buildGrid("XY", 0x7aabcc));
  scene.add(buildGrid("XZ", 0x7aabcc));
  scene.add(buildGrid("YZ", 0x7aabcc));

  // ── Axis lines ────────────────────────────────────────────────────────────────
  function makeAxisLine(to, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(...to)
    ]);
    return new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
  }
  scene.add(makeAxisLine([1.15, 0, 0], 0xcc2222)); // X - red
  scene.add(makeAxisLine([0, 1.15, 0], 0x22aa44)); // Y - green
  scene.add(makeAxisLine([0, 0, 1.15], 0x2255cc)); // Z - blue

  // ── Rocket group (orientation is applied to this) ─────────────────────────────
  const rocketGroup = new THREE.Group();
  rocketGroup.position.set(0.5, 0.3, 0.5);
  scene.add(rocketGroup);

  // ── Load GLTF rocket model ────────────────────────────────────────────────────
  const loader = new THREE.GLTFLoader();
  loader.load(
    "/models/Starship.glb",          // ← put your GLB at public/models/rocket.glb
    (gltf) => {
      const model = gltf.scene;

      // Auto-scale to a consistent size regardless of source model dimensions
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      model.scale.setScalar(1.2 / maxDim);

      // Center the model at the group's origin
      box.setFromObject(model);
      const center = new THREE.Vector3();
      box.getCenter(center);
      model.position.sub(center);

      // If your model's nose points along Z or X instead of Y, adjust here:
      // model.rotation.x = -Math.PI / 2;  // if nose points along -Z
      // model.rotation.z = Math.PI / 2;   // if nose points along X

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      rocketGroup.add(model);
      console.log("Rocket model loaded successfully.");
    },
    (progress) => {
      if (progress.total > 0) {
        console.log(`Loading rocket: ${Math.round(progress.loaded / progress.total * 100)}%`);
      }
    },
    (err) => {
      console.error("Failed to load rocket GLB:", err);
      console.warn("Falling back to primitive rocket model.");

      // ── Fallback: primitive rocket if GLB fails to load ─────────────────────
      const bodyMat = new THREE.MeshPhongMaterial({ color: 0x4fc3f7, shininess: 90 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.052, 0.36, 20), bodyMat);
      body.position.y = 0.18;
      rocketGroup.add(body);

      const noseMat = new THREE.MeshPhongMaterial({ color: 0xb3e5fc, shininess: 120 });
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.17, 20), noseMat);
      nose.position.y = 0.36 + 0.085;
      rocketGroup.add(nose);

      const bellMat = new THREE.MeshPhongMaterial({ color: 0x78909c, shininess: 60 });
      const bell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.038, 0.055, 0.06, 16, 1, true),
        bellMat
      );
      bell.position.y = -0.03;
      rocketGroup.add(bell);

      const finMat = new THREE.MeshPhongMaterial({ color: 0x0277bd, side: THREE.DoubleSide });
      for (let i = 0; i < 4; i++) {
        const shape = new THREE.Shape();
        shape.moveTo(0,     0);
        shape.lineTo(0.11, -0.07);
        shape.lineTo(0.09,  0.13);
        shape.lineTo(0,     0.09);
        const fin = new THREE.Mesh(new THREE.ShapeGeometry(shape), finMat);
        const angle = (i * Math.PI) / 2;
        fin.rotation.y = angle;
        fin.rotation.x = Math.PI / 2;
        fin.position.set(Math.sin(angle) * 0.052, 0.04, Math.cos(angle) * 0.052);
        rocketGroup.add(fin);
      }
    }
  );

  resize();

  // ── Render loop ───────────────────────────────────────────────────────────────
  (function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  })();

  // ── Orientation logic ─────────────────────────────────────────────────────────
  // Same tilt-compensated approach as the Python reference script:
  // accel defines the "up" (gravity) vector, mag defines heading.
  let accelVec = new THREE.Vector3(0, 1, 0);
  let magVec   = new THREE.Vector3(1, 0, 0);

  function applyOrientation() {
    const up    = accelVec.clone().normalize();
    const east  = new THREE.Vector3().crossVectors(magVec.clone().normalize(), up).normalize();
    const north = new THREE.Vector3().crossVectors(up, east).normalize();
    rocketGroup.setRotationFromMatrix(new THREE.Matrix4().makeBasis(east, up, north));
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  // Call with: { mag: {x,y,z}, accel: {x,y,z} }
  // Both are optional — pass whichever you have available each frame.
  return function updateRocketOrientation({ mag, accel } = {}) {
    if (accel) accelVec.set(accel.x, accel.y, accel.z);
    if (mag)   magVec.set(mag.x, mag.y, mag.z);
    applyOrientation();
  };
}