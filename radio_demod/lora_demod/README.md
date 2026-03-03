# LoRa Demod
A GNU Radio + GR-LoRa Python script that demodulates LoRa packets and broadcasts them verbatim over a WebSocket server. The Rust code in the base station connects to this WebSocket to decode Sirin packets.

## Running
The recommended way to launch is via the orchestrator in the parent directory:
```
python3 ../launch_demodulator.py --lora
```

Or run standalone:
```
python3 lora_demod.py [options]
```

## Options
```
--port PORT            WebSocket server port (default: 8765)
--host HOST            WebSocket server host (default: localhost)
--zmq                  Read IQ from a ZMQ SUB socket instead of HackRF directly
--zmq-addr ZMQ_ADDR    ZMQ endpoint to subscribe to (default: tcp://127.0.0.1:5555)
--center-freq HZ       Center frequency in Hz (default: 434.5e6)
--bandwidth HZ         Bandwidth in Hz (default: 125000)
--sample-rate HZ       Sample rate in Hz (default: 2000000)
--spreading-factor SF  LoRa spreading factor (default: 7)
--gain GAIN            HackRF gain (default: 20)
--payload-len N        Payload length in bytes (default: 256)
--sync-word WORD       LoRa sync word, e.g. 0x12 (default: 0x12)
```

## ZMQ mode
When running alongside TeleGPS, use `--zmq` so only one process owns the HackRF. The [ZMQ splitter](../zmq_splitter/README.md) publishes raw IQ to both demodulators. `launch_demodulator.py` handles this automatically when both `-l` and `-t` are passed.

## Dependencies
GNU Radio with `gr-lora-sdr`, and the `websockets` Python package.

## Maintenance
If you add a dependency, document it here.
