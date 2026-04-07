#! /bin/bash
LOGDIR="log/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$LOGDIR/raw"
rx_fm -f 434.55M -s 2000000 -r 24000 -d driver=hackrf - | direwolf -n 1 -r 24000 -b 16 -L "$LOGDIR/tele-gps.csv" - | tee >(ts -s > "$LOGDIR/raw/tele-gps-direwolf.log")
