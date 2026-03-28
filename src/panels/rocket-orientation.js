// rocket-orientation.js
// Displays a 3D rocket orientation using quaternion data from the flight computer.
//
// Primary mode:  quaternion (r, x, y, z) from the Kalman filter on the firmware
// Fallback mode: gyroscope integration (angular_vel) if no quaternion available

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export async function createRocketOrientation(containerId) {
  const container = document.getElementById(containerId);
 
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
        background: #1a1a2e;
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

  const canvas = document.getElementById(`${containerId}-canvas`);
  const circle = document.getElementById(`${containerId}-circle`);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch (e) {
    console.error(`[RocketOrientation] FAIL: WebGLRenderer creation threw:`, e);
    return () => {};
  }

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

  new ResizeObserver((entries) => {
    resize();
  }).observe(circle);

  resize();

  //Scene and lighting
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(3, 5, 4);
  sun.castShadow = true;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xaaccff, 0.3);
  fill.position.set(-2, 1, -2);
  scene.add(fill);

  const GRID_SIZE = 1.0;
  const GRID_DIVS = 5;
  const step = GRID_SIZE / GRID_DIVS;

  //Builds the grid 
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

  //Attempts to add each plane
  try {
    scene.add(buildGrid("XY", 0x00e5ff));
    scene.add(buildGrid("XZ", 0x00e5ff));
    scene.add(buildGrid("YZ", 0x00e5ff));
  } catch (e) {
    console.error(`[RocketOrientation] FAIL: Grid build threw:`, e);
  }

  //Function adds axis lines
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

  const rocketGroup = new THREE.Group();
  rocketGroup.position.set(0.5, 0.3, 0.5);
  scene.add(rocketGroup);

  //Loads Aurora.glb
  const loader = new GLTFLoader();
  loader.load(
    "/public/models/Aurora.glb",
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
    (progress) => {
      if (progress.total > 0) {
        console.log(`[RocketOrientation] Loading Aurora.glb: ${Math.round(progress.loaded / progress.total * 100)}%`);
      }
    },
    (err) => {
      console.error(`[RocketOrientation] FAIL: Aurora.glb failed to load:`, err);
    }
  );

  //Animation loop
  let frameCount = 0;
  (function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    frameCount++;
  })();

  //Initialize a null quaternion
  let quatR = 1, quatX = 0, quatY = 0, quatZ = 0;
  let lastGyroTime = null;

  //Complicated matrix math
  function applyQuaternion(r, x, y, z) {
    const n = Math.sqrt(r*r + x*x + y*y + z*z);
    const w = r/n, qx = x/n, qy = y/n, qz = z/n;

    const m = new THREE.Matrix4().set(
      1 - 2*(qy*qy + qz*qz),     2*(qx*qy - qz*w),     2*(qx*qz + qy*w), 0,
          2*(qx*qy + qz*w), 1 - 2*(qx*qx + qz*qz),     2*(qy*qz - qx*w), 0,
          2*(qx*qz - qy*w),     2*(qy*qz + qx*w), 1 - 2*(qx*qx + qy*qy), 0,
      0, 0, 0, 1
    );

    rocketGroup.setRotationFromMatrix(m);
  }

  return function updateRocketOrientation({ quat } = {}) {
    quatR = quat.r; quatX = quat.x; quatY = quat.y; quatZ = quat.z;
    applyQuaternion(quatR, quatZ, quatX, quatY);
    return;
  };
}