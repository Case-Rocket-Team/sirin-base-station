import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Grid, OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

type Props = {
  quatW: number | null;
  quatX: number | null;
  quatY: number | null;
  quatZ: number | null;
};

export default function RocketOrientation({ quatW, quatX, quatY, quatZ }: Props) {
  const quaternion = useMemo(() => normalizeQuaternion(quatW, quatX, quatY, quatZ), [quatW, quatX, quatY, quatZ]);

  if (!quaternion) {
    return <EmptyOrientationState message="Waiting for valid quaternion telemetry." />;
  }

  return (
    <Canvas camera={{ position: [6, 6, 8], fov: 40 }}>
      <color attach="background" args={["#05070e"]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[6, 8, 8]} intensity={1.6} />
      <Suspense fallback={null}>
        <Environment preset="city" />
        <RocketModel quaternion={quaternion} />
      </Suspense>
      <Grid args={[20, 20]} sectionColor="#2f78c7" cellColor="#17304c" fadeDistance={28} fadeStrength={1} />
      <axesHelper args={[4]} />
      <OrbitControls enablePan={false} />
    </Canvas>
  );
}

function RocketModel({ quaternion }: { quaternion: THREE.Quaternion }) {
  const ref = useRef<THREE.Group>(null);
  const { scene } = useGLTF("/models/Aurora.glb");

  useFrame(() => {
    if (ref.current) {
      ref.current.quaternion.slerp(quaternion, 0.2);
    }
  });

  return <primitive ref={ref} object={scene.clone()} scale={1.4} />;
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
