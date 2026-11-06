#!/bin/bash
eval "$(conda shell.bash hook)"
conda activate gnuradio
python sirin_demod.py "$@"
