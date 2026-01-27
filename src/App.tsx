import { useState, useEffect } from "react";
import reactLogo from "./assets/react.svg";
import "./App.css";

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface Quaternion {
  r: number;
  x: number;
  y: number;
  z: number;
}

interface AngularVel {
  x_pitch: number;
  y_roll: number;
  z_yaw: number;
}

interface NominalState {
  pos: Vec3;
  vel: Vec3;
  accel: Vec3;
  rot_quaternion: Quaternion;
  accel_bias: Vec3;
  angular_vel_bias: AngularVel;
}

function App() {
  const [nominalState, setNominalState] = useState<NominalState | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:9001");

    ws.onopen = () => {
      console.log("WebSocket connected");
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const state: NominalState = JSON.parse(event.data);
        setNominalState(state);
      } catch (e) {
        console.error("Failed to parse message:", e);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      setConnected(false);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <main className="container">
      <h1>Packet Visualizer</h1>

      <div className="row">
        <a href="https://vitejs.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://reactjs.org" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>

      <p>
        <strong>WebSocket Status:</strong>{" "}
        <span style={{ color: connected ? "green" : "red" }}>
          {connected ? "Connected" : "Disconnected"}
        </span>
      </p>

      {nominalState && (
        <div style={{ textAlign: "left", marginTop: "1rem" }}>
          <h3>NominalState (Live)</h3>
          <p><strong>Position:</strong> x={nominalState.pos.x.toFixed(4)}, y={nominalState.pos.y.toFixed(4)}, z={nominalState.pos.z.toFixed(4)}</p>
          <p><strong>Velocity:</strong> x={nominalState.vel.x.toFixed(4)}, y={nominalState.vel.y.toFixed(4)}, z={nominalState.vel.z.toFixed(4)}</p>
          <p><strong>Acceleration:</strong> x={nominalState.accel.x.toFixed(4)}, y={nominalState.accel.y.toFixed(4)}, z={nominalState.accel.z.toFixed(4)}</p>
          <p><strong>Quaternion:</strong> r={nominalState.rot_quaternion.r.toFixed(4)}, x={nominalState.rot_quaternion.x.toFixed(4)}, y={nominalState.rot_quaternion.y.toFixed(4)}, z={nominalState.rot_quaternion.z.toFixed(4)}</p>
          <p><strong>Accel Bias:</strong> x={nominalState.accel_bias.x.toFixed(4)}, y={nominalState.accel_bias.y.toFixed(4)}, z={nominalState.accel_bias.z.toFixed(4)}</p>
          <p><strong>Angular Vel Bias:</strong> pitch={nominalState.angular_vel_bias.x_pitch.toFixed(4)}, roll={nominalState.angular_vel_bias.y_roll.toFixed(4)}, yaw={nominalState.angular_vel_bias.z_yaw.toFixed(4)}</p>
        </div>
      )}
    </main>
  );
}

export default App;
