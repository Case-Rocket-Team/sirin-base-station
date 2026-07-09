import { useEffect, useState, type ReactNode } from "react";
import { useTelemetrySource } from "../telemetry/useTelemetrySource";
import type { AppConfig, RecordingFormat, TelemetrySource } from "../telemetry/types";

type Props = {
  selectedSource: TelemetrySource;
};

export default function SettingsPanel({ selectedSource }: Props) {
  const telemetry = useTelemetrySource(selectedSource);
  const [draft, setDraft] = useState<AppConfig | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (telemetry.snapshot?.config) {
      setDraft(telemetry.snapshot.config);
    }
  }, [telemetry.snapshot?.config]);

  const handleSave = async () => {
    if (!draft) {
      return;
    }
    setMessage(null);
    setError(null);
    try {
      await telemetry.updateConfig(draft);
      await telemetry.refreshSnapshot();
      setMessage("Settings saved to backend state.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  };

  const handleStartDemod = async () => {
    setMessage(null);
    setError(null);
    try {
      await telemetry.startLoraDemod();
      await telemetry.refreshSnapshot();
      setMessage("LoRa demod start requested.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  };

  const handleStopDemod = async () => {
    setMessage(null);
    setError(null);
    try {
      await telemetry.stopLoraDemod();
      await telemetry.refreshSnapshot();
      setMessage("LoRa demod stop requested.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  };

  if (!draft) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6 text-slate-300 backdrop-blur">
        Loading settings...
      </section>
    );
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-4 backdrop-blur">
      <div className="grid gap-4 lg:grid-cols-2">
        <SettingField label="LoRa WebSocket URL">
          <input
            value={draft.loraWebsocketUrl}
            onChange={(event) => setDraft({ ...draft, loraWebsocketUrl: event.target.value })}
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-slate-100 outline-none focus:border-cyan-300/40"
          />
        </SettingField>

        <SettingField label="Expected Packets Per Second">
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={draft.expectedPacketsPerSecond}
            onChange={(event) =>
              setDraft({ ...draft, expectedPacketsPerSecond: Number(event.target.value) })
            }
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-slate-100 outline-none focus:border-cyan-300/40"
          />
        </SettingField>

        <SettingField label="Stale Timeout (ms)">
          <input
            type="number"
            min="1"
            step="100"
            value={draft.staleTimeoutMs}
            onChange={(event) => setDraft({ ...draft, staleTimeoutMs: Number(event.target.value) })}
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-slate-100 outline-none focus:border-cyan-300/40"
          />
        </SettingField>

        <SettingField label="Recording Directory">
          <input
            value={draft.recordingDirectory}
            onChange={(event) => setDraft({ ...draft, recordingDirectory: event.target.value })}
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-slate-100 outline-none focus:border-cyan-300/40"
          />
        </SettingField>

        <SettingField label="Altitude Minimum (ft)">
          <input
            type="number"
            value={draft.altitudeMinFt}
            onChange={(event) => setDraft({ ...draft, altitudeMinFt: Number(event.target.value) })}
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-slate-100 outline-none focus:border-cyan-300/40"
          />
        </SettingField>

        <SettingField label="Altitude Maximum (ft)">
          <input
            type="number"
            value={draft.altitudeMaxFt}
            onChange={(event) => setDraft({ ...draft, altitudeMaxFt: Number(event.target.value) })}
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-slate-100 outline-none focus:border-cyan-300/40"
          />
        </SettingField>

        <SettingField label="Target Altitude (ft)">
          <input
            type="number"
            value={draft.targetAltitudeFt}
            onChange={(event) => setDraft({ ...draft, targetAltitudeFt: Number(event.target.value) })}
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-slate-100 outline-none focus:border-cyan-300/40"
          />
        </SettingField>

        <SettingField label="Default Recording Format">
          <select
            value={draft.defaultRecordingFormat}
            onChange={(event) =>
              setDraft({
                ...draft,
                defaultRecordingFormat: event.target.value as RecordingFormat,
              })
            }
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-slate-100 outline-none focus:border-cyan-300/40"
          >
            <option value="jsonl">JSONL</option>
            <option value="csv">CSV</option>
          </select>
        </SettingField>

        <SettingField label="LoRa Demod Script Path">
          <input
            value={draft.loraDemodPath}
            onChange={(event) => setDraft({ ...draft, loraDemodPath: event.target.value })}
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-slate-100 outline-none focus:border-cyan-300/40"
          />
        </SettingField>

        <SettingField label="LoRa Demod Host">
          <input
            value={draft.loraDemodHost}
            onChange={(event) => setDraft({ ...draft, loraDemodHost: event.target.value })}
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-slate-100 outline-none focus:border-cyan-300/40"
          />
        </SettingField>

        <SettingField label="LoRa Demod Port">
          <input
            type="number"
            min="1"
            max="65535"
            value={draft.loraDemodPort}
            onChange={(event) => setDraft({ ...draft, loraDemodPort: Number(event.target.value) })}
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-slate-100 outline-none focus:border-cyan-300/40"
          />
        </SettingField>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={() => void handleSave()}
          className="rounded-xl bg-cyan-300 px-5 py-3 font-mono text-xs uppercase tracking-[0.25em] text-slate-950 hover:bg-cyan-200"
        >
          Save Settings
        </button>
        <button
          onClick={() => void handleStartDemod()}
          className="rounded-xl bg-emerald-400/90 px-5 py-3 font-mono text-xs uppercase tracking-[0.25em] text-slate-950"
        >
          Start Demod
        </button>
        <button
          onClick={() => void handleStopDemod()}
          className="rounded-xl bg-rose-500/80 px-5 py-3 font-mono text-xs uppercase tracking-[0.25em] text-white"
        >
          Stop Demod
        </button>
        {message && <p className="text-sm text-emerald-300">{message}</p>}
        {error && <p className="text-sm text-rose-300">{error}</p>}
      </div>

      <div className="mt-4 rounded-2xl border border-white/8 bg-black/25 p-4 text-sm text-slate-200">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400">Demod Status</p>
        <p className="mt-2">Running: {telemetry.demodStatus?.running ? "Yes" : "No"}</p>
        <p>Path: {telemetry.demodStatus?.path ?? "--"}</p>
        <p>Host: {telemetry.demodStatus?.host ?? "--"}</p>
        <p>Port: {telemetry.demodStatus?.port ?? "--"}</p>
        {telemetry.demodStatus?.lastError && <p className="mt-2 text-rose-300">{telemetry.demodStatus.lastError}</p>}
      </div>
    </section>
  );
}

function SettingField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="rounded-2xl border border-white/8 bg-black/25 p-4 text-sm text-slate-300">
      <span className="mb-3 block font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}
