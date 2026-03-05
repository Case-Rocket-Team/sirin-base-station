# LoRa Demod
This is a small Python script that uses GNU Radio and GR-LoRa to demodulate LoRa packets and broadcast them verbatim on a websocket server. Somewhere else, some Rust code can then connect to the websocket and actually decode the Sirin packets.

## Usage
```
./lora_demod.sh [-h] [--port PORT] [--host HOST]

options:
  -h, --help   show this help message and exit
  --port PORT  Port of the websocket server, default 8765
  --host HOST  Host of the websocket server, default localhost
```

## Running
Unfortunately, this project uses Conda, so install that if you haven't already. Luckily for you, though, you can run `./lora_demod.sh` which will set up the Conda venv for you, install the required packages, and run the LoRa demodulator and output the packets to a websocket server. Alternatively you can just run `lora_demod.py` in a venv with everything installed, if you happen to have that on hand. I've tested this on Ubuntu, you're on your own if you're using a different OS. The first launch takes about 5 minutes to install everything on my machine (sorry, conda is slow).

Right now, it's hardcoded to use HackRF, but you should be able to edit it to use whatever SDR you want.

## Maintenance
If you add a dependency, please add it to the `./run.sh` so that someone else isn't left to track down your unspecified dependencies somewhere down the line!