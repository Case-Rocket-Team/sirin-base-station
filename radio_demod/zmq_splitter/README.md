# ZMQ Splitter
A GNU Radio Python script that reads raw IQ from a HackRF and publishes it to two ZMQ PUB endpoints simultaneously. This allows multiple demodulators to share a single HackRF, since only one process can own the hardware at a time.

## Running
The recommended way to launch is via the orchestrator in the parent directory:
```
python3 ../launch_demodulator.py --telegps   # starts splitter + telegps
python3 ../launch_demodulator.py -l -t       # starts splitter + lora + telegps
```

Or run standalone:
```
python3 zmq_message_publisher.py [options]
```

## Options
```
--freq HZ         Center frequency in Hz (default: 434.5e6)
--samp-rate RATE  Sample rate in Hz (default: 2000000)
--bw HZ           Bandwidth in Hz (default: 125000)
--gain GAIN       HackRF gain (default: 20)
--addr0 ADDR      First ZMQ PUB endpoint (default: tcp://127.0.0.1:5555)
--addr1 ADDR      Second ZMQ PUB endpoint (default: tcp://127.0.0.1:5556)
--hwm N           ZMQ high-water mark (default: 256)
--timeout MS      ZMQ timeout in ms (default: 100)
```

## Address assignment
By convention (and as set by `launch_demodulator.py`):
- `addr0` (port 5555) → LoRa demod
- `addr1` (port 5556) → TeleGPS demod

## Dependencies
GNU Radio with `gr-soapy` and `gr-zeromq`. HackRF drivers must be installed.

## Maintenance
If you add a dependency, document it here.
