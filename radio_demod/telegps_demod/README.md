# TeleGPS Demod

Receives raw IQ samples from the [ZMQ splitter](../zmq_splitter/README.md) and operates in one of two modes:

| Mode | What it does |
|---|---|
| `direwolf` (default) | NBFM demodulation → int16 PCM → Direwolf (APRS/AX.25 decoder) |
| `rtl_tcp` | Raw IQ passthrough → uint8 interleaved → rtl_tcp TCP server for SDR# |

## Running

Recommended — via the orchestrator:
```
python3 ../launch_demodulator.py --telegps
```

Or standalone:
```
python3 telegps_demod.py [options]
```

## Options

```
--addr ADDR            ZMQ SUB endpoint to receive IQ from (default: tcp://127.0.0.1:5555)
--samp-rate RATE       Input sample rate in Hz (default: 2000000)
--audio-rate RATE      Output audio rate in Hz, direwolf mode only (default: 24000)
--freq-offset HZ       Frequency offset from HackRF center, direwolf mode only (default: 0)
--mode MODE            Output mode: 'direwolf' or 'rtl_tcp' (default: direwolf)
--rtl-tcp-host HOST    Bind host for rtl_tcp server (default: 0.0.0.0)
--rtl-tcp-port PORT    Bind port for rtl_tcp server (default: 1234)
```

## Mode: direwolf

HackRF → ZMQ splitter → **telegps_demod** → stdout (int16 PCM) → Direwolf

Applies frequency translation (`--freq-offset`) and NBFM demodulation in GNU Radio, then pipes 16-bit PCM to Direwolf for APRS/AX.25 decoding.

## Mode: rtl_tcp

HackRF → ZMQ splitter → **telegps_demod** → TCP server → SDR#

Converts complex64 IQ samples from ZMQ to interleaved uint8 (rtl_tcp wire format) and serves them on a TCP socket. SDR# connects as if it were talking to a remote RTL-SDR dongle and handles all demodulation itself.

### Connecting SDR# in rtl_tcp mode

1. Set `"mode": "rtl_tcp"` in `demodulator_config.json` (and optionally `rtl_tcp_host`/`rtl_tcp_port`).
2. Start the demodulator — it will print `[rtl_tcp] Listening on 0.0.0.0:1234`.
3. In SDR#, select **RTL-SDR (TCP)** as the source.
4. Set the host/port to match (e.g. `localhost:1234`).
5. Set the center frequency in SDR# to match your HackRF center frequency (e.g. `434.675 MHz`).
6. Connect and use SDR#'s demodulators and waterfall normally.

> **Note:** SDR# will send tuning commands (set frequency, gain, etc.) which are silently ignored — the HackRF center frequency is fixed by the ZMQ splitter. Set the correct center frequency manually in SDR#.

## Config file fields (`demodulator_config.json`)

```json
"telegps_demod": {
    "enabled": true,
    "center_freq": 434550000,
    "sample_rate": 2000000,
    "audio_rate": 25000,
    "mode": "direwolf",
    "rtl_tcp_host": "0.0.0.0",
    "rtl_tcp_port": 1234
}
```

## Dependencies

- **direwolf mode:** GNU Radio with `gr-analog`, `gr-blocks`, `gr-zeromq`; Direwolf
- **rtl_tcp mode:** `pyzmq`, `numpy` (no GNU Radio required)
