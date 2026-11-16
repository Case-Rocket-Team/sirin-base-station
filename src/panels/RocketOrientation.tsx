import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

type Props = {
  quatW: number | null;
  quatX: number | null;
  quatY: number | null;
  quatZ: number | null;
};

export default function RocketOrientation({ quatW, quatX, quatY, quatZ }: Props) {
  const incoming = useMemo(() => normalizeQuaternion(quatW, quatX, quatY, quatZ), [quatW, quatX, quatY, quatZ]);
  // Packets without a usable quaternion (Ok/Mode replies, all-zero quaternions)
  // keep the last good orientation instead of unmounting the whole 3D scene.
  const lastValid = useRef<THREE.Quaternion | null>(null);
  if (incoming) {
    lastValid.current = incoming;
  }
  const quaternion = lastValid.current;

  if (!quaternion) {
    return <EmptyOrientationState message="Waiting for valid quaternion telemetry." />;
  }

  return (
    <Canvas camera={{ position: [1.5, 1.2, 1.7], fov: 42, near: 0.01, far: 100 }} dpr={[1, 2]}>
      <color attach="background" args={["#1a1a2e"]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[3, 5, 4]} intensity={0.9} castShadow />
      <directionalLight position={[-2, 1, -2]} color="#aaccff" intensity={0.3} />
      <Suspense fallback={null}>
        <Environment preset="city" />
        <RocketModel quaternion={quaternion} />
      </Suspense>
      <DoubleSidedGrid position={[1.5, 0, 1.5]} />
      <DoubleSidedGrid position={[1.5, 1.5, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <DoubleSidedGrid position={[0, 1.5, 1.5]} rotation={[0, 0, Math.PI / 2]} />
      <axesHelper args={[1.15]} />
      <OrbitControls enablePan={false} enableZoom={false} />
    </Canvas>
  );
}

function DoubleSidedGrid({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  const gridRef = useRef<THREE.GridHelper>(null);

  useMemo(() => {
    if (gridRef.current) {
      gridRef.current.material.color.set("#00e5ff");
    }
  }, []);

  return (
    <gridHelper ref={gridRef} args={[3, 15]} position={position} rotation={rotation} />
  );
}

function RocketModel({ quaternion }: { quaternion: THREE.Quaternion }) {
  const ref = useRef<THREE.Group>(null);
  const { scene } = useGLTF("/models/Aurora.glb");
  // Clone once: cloning on every render swapped in a fresh, un-rotated model
  // each packet, so it snapped back and re-slerped every time.
  const model = useMemo(() => scene.clone(), [scene]);

  useFrame(() => {
    if (ref.current) {
      // Show the received quaternion as-is (no smoothing).
      ref.current.quaternion.copy(quaternion);
    }
  });

  return <primitive ref={ref} object={model} scale={0.45} position={[0.5, 0.3, 0.5]} />;
}

function normalizeQuaternion(
  w: number | null,
  x: number | null,
  y: number | null,
  z: number | null,
) {
  if (![w, x, y, z].every((value) => typeof value === "number" && Number.isFinite(value))) {
    return null;
  }
  const candidate = new THREE.Quaternion(x as number, y as number, z as number, w as number);
  const length = candidate.length();
  if (!Number.isFinite(length) || length < 1e-6) {
    return null;
  }
  return Math.abs(length - 1) > 0.01 ? candidate.normalize() : candidate;
}

function EmptyOrientationState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_36%),#05070e] text-sm text-slate-300">
      {message}
    </div>
  );
}

useGLTF.preload("/models/Aurora.glb");
