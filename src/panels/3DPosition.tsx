import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Grid, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

type Props = {
  x: number | null;
  y: number | null;
  z: number | null;
};

export default function ThreeDPosition({ x, y, z }: Props) {
  const [history, setHistory] = useState<Array<[number, number, number]>>([]);

  useEffect(() => {
    if ([x, y, z].every((value) => typeof value === "number")) {
      setHistory((current) => {
        const nextPoint: [number, number, number] = [x as number, y as number, z as number];
        if (current.length > 0) {
          const [lastX, lastY, lastZ] = current[current.length - 1];
          if (lastX === nextPoint[0] && lastY === nextPoint[1] && lastZ === nextPoint[2]) {
            return current;
          }
        }
        return [...current.slice(-249), nextPoint];
      });
    }
  }, [x, y, z]);

  if (history.length === 0) {
    return <Empty3dState message="Waiting for valid position values." />;
  }

  const start = history[0];
  const points = history.map((point) => new THREE.Vector3(point[0] - start[0], point[1] - start[1], point[2] - start[2]));

  return (
    <Canvas camera={{ position: [45, 45, 45], fov: 45 }}>
      <color attach="background" args={["#05070e"]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[30, 20, 10]} intensity={1.2} />
      <OrbitControls enablePan enableZoom enableRotate />
      <Bounds fit clip observe margin={1.4}>
        <Grid args={[120, 120]} cellSize={5} sectionSize={20} cellColor="#17304c" sectionColor="#2f78c7" fadeDistance={140} fadeStrength={1} />
        <axesHelper args={[30]} />
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[1.4, 24, 24]} />
          <meshStandardMaterial color="#ef4444" emissive="#7f1d1d" />
        </mesh>
        <mesh position={points[points.length - 1]}>
          <sphereGeometry args={[1.6, 24, 24]} />
          <meshStandardMaterial color="#4ade80" emissive="#14532d" />
        </mesh>
        <Line points={points} color="#fde047" lineWidth={2} />
      </Bounds>
    </Canvas>
  );
}

function Empty3dState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_36%),#05070e] text-sm text-slate-300">
      {message}
    </div>
  );
}
