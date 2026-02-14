# Sirin base station

## Prereqs

Install Node.js, npm, Rust, and conda. Then, do

```sh
npm i
```

in the project root directory.

## Run it

First, start the LoRa demodulator with

```sh
cd ./lora_demod
./lora_demod.sh
```

Then, once that's running you should see radio packets being printed into the console. Now in a separate terminal run

```sh
npm run tauri dev
```

in the project root. A window with the app should pop up.