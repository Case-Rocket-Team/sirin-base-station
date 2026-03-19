import React, { useEffect, useState } from "react";
import Window from "../panels/Window";
import { Channel, invoke } from "@tauri-apps/api/core";
// @ts-ignore
import { createAltitudeBar } from "./AltitudeBar.js";
// @ts-ignore
import { createRocketOrientation } from "./3DOrientation.js";
// @ts-ignore
import { createTelemetryBar } from "./TelemetryBar.js";
// @ts-ignore
import { createTelemetryStatus } from "./TelemetryStatus.js";
// @ts-ignore
import { createPositionTrace } from "./3DPosition.js";
// @ts-ignore
import { createApogeePredictor } from "./ApogeePredictor.js";

type Props = {
  goBack: () => void;
};

export default function TelemetryPanel({ goBack }: Props) {

  return (
    <main>
      <button onClick={goBack}> ← Back </button>
    </main>
  );
}
