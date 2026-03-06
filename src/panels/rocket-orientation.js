// rocket-orientation.js
// Displays a 3D rocket orientation using quaternion data from the flight computer.
//
// Primary mode:  quaternion (r, x, y, z) from the Kalman filter on the firmware
// Fallback mode: gyroscope integration (angular_vel) if no quaternion available
//
// Usage:
//   const updateOrientation = await createRocketOrientation("my-container-id");
//
//   // Best — pass quaternion directly from NominalState:
//   updateOrientation({ quat: { r, x, y, z } });
//
//   // Fallback — pass gyro angular velocity (microDeg/s) + dt in seconds:
//   updateOrientation({ gyro: { x, y, z }, dt: 0.1 });
//
//   // Also accepts raw accel for gravity alignment on init:
//   updateOrientation({ accel: { x, y, z } });

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
        background: #b0b0b0;
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
  renderer.setClearColor(0x1a1a2e, 1);
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
      } else {
        pts.push(0, t, 0,   0, t, GRID_SIZE);
        pts.push(0, 0, t,   0, GRID_SIZE, t);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 });
    return new THREE.LineSegments(geo, mat);
  }

  scene.add(buildGrid("XY", 0x00e5ff));
  scene.add(buildGrid("XZ", 0x00e5ff));
  scene.add(buildGrid("YZ", 0x00e5ff));

  // ── Axis lines ────────────────────────────────────────────────────────────────
  function makeAxisLine(to, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(...to)
    ]);
    return new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
  }
  scene.add(makeAxisLine([1.15, 0, 0], 0xcc2222));
  scene.add(makeAxisLine([0, 1.15, 0], 0x22aa44));
  scene.add(makeAxisLine([0, 0, 1.15], 0x2255cc));

  // ── Rocket group ──────────────────────────────────────────────────────────────
  const rocketGroup = new THREE.Group();
  rocketGroup.position.set(0.5, 0.3, 0.5);
  scene.add(rocketGroup);

  // ── Load GLTF model, fallback to primitives ───────────────────────────────────
  const loader = new THREE.GLTFLoader();
  loader.load(
    "/models/Aurora.glb",
    (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      model.scale.setScalar(1.2 / maxDim);
      box.setFromObject(model);
      const center = new THREE.Vector3();
      box.getCenter(center);
      model.position.sub(center);
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      rocketGroup.add(model);
    },
    undefined,
    () => {
      // Fallback primitive rocket
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
        new THREE.CylinderGeometry(0.038, 0.055, 0.06, 16, 1, true), bellMat
      );
      bell.position.y = -0.03;
      rocketGroup.add(bell);

      const finMat = new THREE.MeshPhongMaterial({ color: 0x0277bd, side: THREE.DoubleSide });
      for (let i = 0; i < 4; i++) {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(0.11, -0.07);
        shape.lineTo(0.09, 0.13);
        shape.lineTo(0, 0.09);
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

  // ── Quaternion state ──────────────────────────────────────────────────────────
  // Matches the firmware's NominalState quaternion: (r=w, x, y, z)
  // Initialized to identity (no rotation)
  let quatR = 1, quatX = 0, quatY = 0, quatZ = 0;

  // For gyro integration fallback
  let lastGyroTime = null;

  // ── Quaternion → rotation matrix (same as Python's quat_to_matrix) ────────────
  function applyQuaternion(r, x, y, z) {
    // Normalize
    const n = Math.sqrt(r*r + x*x + y*y + z*z);
    const w = r/n, qx = x/n, qy = y/n, qz = z/n;

    // Build rotation matrix — identical to Python quat_to_matrix
    const m = new THREE.Matrix4().set(
      1 - 2*(qy*qy + qz*qz),     2*(qx*qy - qz*w),     2*(qx*qz + qy*w), 0,
          2*(qx*qy + qz*w), 1 - 2*(qx*qx + qz*qz),     2*(qy*qz - qx*w), 0,
          2*(qx*qz - qy*w),     2*(qy*qz + qx*w), 1 - 2*(qx*qx + qy*qy), 0,
      0, 0, 0, 1
    );

    rocketGroup.setRotationFromMatrix(m);
  }

  // ── Gyro integration fallback ─────────────────────────────────────────────────
  // Integrates angular velocity into the quaternion using first-order integration.
  // angular_vel from firmware is in microDegrees/s
  function integrateGyro(gx, gy, gz, dt) {
    const MICRO_DEG_TO_RAD = Math.PI / 180.0 / 1e6;

    // Convert to rad/s — note firmware negates pitch and yaw, match that
    const wx = gx * MICRO_DEG_TO_RAD * -1.0; // pitch (negated in firmware)
    const wy = gy * MICRO_DEG_TO_RAD;         // roll
    const wz = gz * MICRO_DEG_TO_RAD * -1.0; // yaw (negated in firmware)

    // Quaternion derivative: dq/dt = 0.5 * q * [0, wx, wy, wz]
    const dqr = 0.5 * (-quatX*wx - quatY*wy - quatZ*wz);
    const dqx = 0.5 * ( quatR*wx + quatY*wz - quatZ*wy);
    const dqy = 0.5 * ( quatR*wy - quatX*wz + quatZ*wx);
    const dqz = 0.5 * ( quatR*wz + quatX*wy - quatY*wx);

    quatR += dqr * dt;
    quatX += dqx * dt;
    quatY += dqy * dt;
    quatZ += dqz * dt;

    // Normalize to prevent drift
    const norm = Math.sqrt(quatR*quatR + quatX*quatX + quatY*quatY + quatZ*quatZ);
    quatR /= norm; quatX /= norm; quatY /= norm; quatZ /= norm;

    applyQuaternion(quatR, quatX, quatY, quatZ);
  }

  // ── Accel-based gravity alignment for initialization ──────────────────────────
  // Used only on first reading to set an initial orientation before gyro takes over
  let initialized = false;
  function initFromAccel(ax, ay, az) {
    const up = new THREE.Vector3(ax, ay, az).normalize();
    const absX = Math.abs(up.x), absY = Math.abs(up.y), absZ = Math.abs(up.z);
    let ref;
    if (absX <= absY && absX <= absZ)      ref = new THREE.Vector3(1, 0, 0);
    else if (absY <= absX && absY <= absZ) ref = new THREE.Vector3(0, 1, 0);
    else                                   ref = new THREE.Vector3(0, 0, 1);

    const right   = new THREE.Vector3().crossVectors(ref, up).normalize();
    const forward = new THREE.Vector3().crossVectors(up, right).normalize();
    const m = new THREE.Matrix4().makeBasis(right, up, forward);
    rocketGroup.setRotationFromMatrix(m);

    // Extract quaternion from the matrix for continuity with gyro integration
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    quatR = q.w; quatX = q.x; quatY = q.y; quatZ = q.z;
    initialized = true;
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  // Priority: quat > gyro > accel
  //
  // From TelemetryPanel, call with:
  //   updateOrientation({ quat: logEntry.log.State.nominal.rotQuaternion })
  // or with raw sensor data:
  //   updateOrientation({ gyro: data.imu.angular_vel.Ok, accel: data.imu.accel.Ok })
  return function updateRocketOrientation({ quat, gyro, accel } = {}) {

    // Best case: direct quaternion from Kalman filter
    if (quat) {
      quatR = quat.r; quatX = quat.x; quatY = quat.y; quatZ = quat.z;
      applyQuaternion(quatR, quatX, quatY, quatZ);
      initialized = true;
      return;
    }

    // Initialize orientation from accel on first reading
    if (!initialized && accel) {
      initFromAccel(accel.x / 1e6, accel.y / 1e6, accel.z / 1e6); // MicroGs → Gs
    }

    // Gyro integration
    if (gyro) {
      const now = performance.now();
      if (lastGyroTime !== null) {
        const dt = (now - lastGyroTime) / 1000.0; // ms → seconds
        integrateGyro(gyro.x, gyro.y, gyro.z, dt);
      }
      lastGyroTime = now;
    }
  };
}