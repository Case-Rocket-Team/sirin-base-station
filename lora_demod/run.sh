# fuck conda seriously
if [ ! -d "./.venv" ]; then
    conda create -y -p ./.venv -c tapparelj -c conda-forge gnuradio gnuradio-lora_sdr
fi
eval "$(conda shell.bash hook)"
conda activate ./.venv
cargo run