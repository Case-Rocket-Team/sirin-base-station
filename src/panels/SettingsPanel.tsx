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
    <section className="rounded-[20px] border border-white/10 bg-slate-950/55 p-2 backdrop-blur">
      <div className="grid gap-1 grid-cols-5">
        <SettingField label="LoRa WebSocket URL">
          <input
            value={draft.loraWebsocketUrl}
            onChange={(event) => setDraft({ ...draft, loraWebsocketUrl: event.target.value })}
            className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-1.5 py-1 text-slate-100 outline-none focus:border-cyan-300/40 text-[10px]"
          />
        </SettingField>

        <SettingField label="Expected Packets Per Sec">
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={draft.expectedPacketsPerSecond}
            onChange={(event) =>
              setDraft({ ...draft, expectedPacketsPerSecond: Number(event.target.value) })
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-1.5 py-1 text-slate-100 outline-none focus:border-cyan-300/40 text-[10px]"
          />
        </SettingField>

        <SettingField label="Stale Timeout (ms)">
          <input
            type="number"
            min="1"
            step="100"
            value={draft.staleTimeoutMs}
            onChange={(event) => setDraft({ ...draft, staleTimeoutMs: Number(event.target.value) })}
            className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-1.5 py-1 text-slate-100 outline-none focus:border-cyan-300/40 text-[10px]"
          />
        </SettingField>

        <SettingField label="Recording Directory">
          <input
            value={draft.recordingDirectory}
            onChange={(event) => setDraft({ ...draft, recordingDirectory: event.target.value })}
            className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-1.5 py-1 text-slate-100 outline-none focus:border-cyan-300/40 text-[10px]"
          />
        </SettingField>

        <SettingField label="Alt Min (ft)">
          <input
            type="number"
            value={draft.altitudeMinFt}
            onChange={(event) => setDraft({ ...draft, altitudeMinFt: Number(event.target.value) })}
            className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-1.5 py-1 text-slate-100 outline-none focus:border-cyan-300/40 text-[10px]"
          />
        </SettingField>

        <SettingField label="Alt Max (ft)">
          <input
            type="number"
            value={draft.altitudeMaxFt}
            onChange={(event) => setDraft({ ...draft, altitudeMaxFt: Number(event.target.value) })}
            className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-1.5 py-1 text-slate-100 outline-none focus:border-cyan-300/40 text-[10px]"
          />
        </SettingField>

        <SettingField label="Target Alt (ft)">
          <input
            type="number"
            value={draft.targetAltitudeFt}
            onChange={(event) => setDraft({ ...draft, targetAltitudeFt: Number(event.target.value) })}
            className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-1.5 py-1 text-slate-100 outline-none focus:border-cyan-300/40 text-[10px]"
          />
        </SettingField>

        <SettingField label="Recording Format">
          <select
            value={draft.defaultRecordingFormat}
            onChange={(event) =>
              setDraft({
                ...draft,
                defaultRecordingFormat: event.target.value as RecordingFormat,
              })
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-1.5 py-1 text-slate-100 outline-none focus:border-cyan-300/40 text-[10px]"
          >
            <option value="jsonl">JSONL</option>
            <option value="csv">CSV</option>
          </select>
        </SettingField>

        <SettingField label="Demod Script Path">
          <input
            value={draft.loraDemodPath}
            onChange={(event) => setDraft({ ...draft, loraDemodPath: event.target.value })}
            className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-1.5 py-1 text-slate-100 outline-none focus:border-cyan-300/40 text-[10px]"
          />
        </SettingField>

        <SettingField label="Demod Host">
          <input
            value={draft.loraDemodHost}
            onChange={(event) => setDraft({ ...draft, loraDemodHost: event.target.value })}
            className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-1.5 py-1 text-slate-100 outline-none focus:border-cyan-300/40 text-[10px]"
          />
        </SettingField>

        <SettingField label="Demod Port">
          <input
            type="number"
            min="1"
            max="65535"
            value={draft.loraDemodPort}
            onChange={(event) => setDraft({ ...draft, loraDemodPort: Number(event.target.value) })}
            className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-1.5 py-1 text-slate-100 outline-none focus:border-cyan-300/40 text-[10px]"
          />
        </SettingField>
      </div>

      <div className="mt-2 flex items-center gap-1">
        <button
          onClick={() => void handleSave()}
          className="rounded-lg bg-cyan-300 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-slate-950 hover:bg-cyan-200"
        >
          Save
        </button>
        <button
          onClick={() => void handleStartDemod()}
          className="rounded-lg bg-emerald-400/90 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-slate-950"
        >
          Start
        </button>
        <button
          onClick={() => void handleStopDemod()}
          className="rounded-lg bg-rose-500/80 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-white"
        >
          Stop
        </button>
        {message && <p className="text-[9px] text-emerald-300">{message}</p>}
        {error && <p className="text-[9px] text-rose-300">{error}</p>}
      </div>

      <div className="mt-2 rounded-lg border border-white/8 bg-black/25 p-1.5 text-[9px] text-slate-200">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400">Demod Status</p>
        <div className="mt-1 grid grid-cols-4 gap-1 text-[9px]">
          <div>
            <p className="text-slate-400 text-[8px]">Running</p>
            <p className="text-[9px]">{telemetry.demodStatus?.running ? "Y" : "N"}</p>
          </div>
          <div>
            <p className="text-slate-400 text-[8px]">Path</p>
            <p className="truncate text-[9px]">{telemetry.demodStatus?.path?.split('/').pop() ?? "--"}</p>
          </div>
          <div>
            <p className="text-slate-400 text-[8px]">Host</p>
            <p className="text-[9px]">{telemetry.demodStatus?.host ?? "--"}</p>
          </div>
          <div>
            <p className="text-slate-400 text-[8px]">Port</p>
            <p className="text-[9px]">{telemetry.demodStatus?.port ?? "--"}</p>
          </div>
        </div>
        {telemetry.demodStatus?.lastError && <p className="mt-1 text-[8px] text-rose-300 line-clamp-1">{telemetry.demodStatus.lastError}</p>}
      </div>
    </section>
  );
}

function SettingField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="rounded-lg border border-white/8 bg-black/25 p-1.5 text-[9px] text-slate-300">
      <span className="mb-0.5 block font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}
