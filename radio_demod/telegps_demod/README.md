# TeleGPS Demod
A GNU Radio Python script that receives raw IQ samples from the [ZMQ splitter](../zmq_splitter/README.md), decimates, and demodulates NBFM to produce 16-bit PCM audio on stdout. This is intended to be piped into [Direwolf](https://github.com/wb2osz/direwolf) for APRS/AX.25 decoding.

## Running
The recommended way to launch is via the orchestrator in the parent directory:
```
python3 ../launch_demodulator.py --telegps
```

Or run standalone:
```
python3 telegps_demod.py [options]
```

## Options
```
--addr ADDR          ZMQ SUB endpoint to receive IQ from (default: tcp://127.0.0.1:5555)
--samp-rate RATE     Input sample rate in Hz (default: 2000000)
--audio-rate RATE    Output audio rate in Hz (default: 24000)
```

## Pipeline
HackRF → ZMQ splitter → **telegps_demod** → stdout (int16 PCM) → Direwolf

The script always requires a ZMQ IQ source — it cannot read from HackRF directly. The [ZMQ splitter](../zmq_splitter/README.md) must be running first.

## Dependencies
GNU Radio with standard blocks (`gr-analog`, `gr-blocks`, `gr-zeromq`).

## Maintenance
If you add a dependency, document it here.
