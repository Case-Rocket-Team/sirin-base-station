python3 zmq_fm_to_direwolf.py --addr tcp://127.0.0.1:5556 --samp-rate 2000000 \
| direwolf -n 1 -r 24000 -b 16 -L "log/$(date)/tele-gps.csv" - \
| tee >(ts -s > "log/$(date)/raw/tele-gps-direwolf.log")