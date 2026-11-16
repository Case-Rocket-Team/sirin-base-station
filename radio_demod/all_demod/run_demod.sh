#!/bin/bash
eval "$(conda shell.bash hook)"
conda activate gnuradio
# exec so python replaces bash: the app then holds python itself and Stop/exit actually kill it
exec python sirin_demod.py "$@"
