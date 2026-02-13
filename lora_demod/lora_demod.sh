if [ ! -d "./.venv" ]; then
    conda create -y -p ./.venv -c tapparelj -c conda-forge gnuradio gnuradio-lora_sdr websockets soapysdr soapysdr-module-hackrf
fi
eval "$(conda shell.bash hook)"
conda activate ./.venv
python lora_demod.py "$@"