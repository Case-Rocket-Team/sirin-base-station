#!/usr/bin/env python3
import sys
import os
import argparse
import json
import signal
import subprocess
import threading
import time
from datetime import datetime
from multiprocessing import Process

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from lora_demod import run as run_lora
from telegps_demod import run as run_telegps
from zmq_splitter import run as run_zmq

DEFAULT_ZMQ_ADDR1 = "tcp://127.0.0.1:5555"
DEFAULT_ZMQ_ADDR2 = "tcp://127.0.0.1:5556"


def watchdog(target, config, name, stop_event):
    while not stop_event.is_set():
        p = Process(target=target, args=(config,), name=name)
        p.start()
        while p.is_alive():
            if stop_event.is_set():
                p.terminate()
                p.join()
                return
            p.join(timeout=1)
        if p.exitcode == 0 or stop_event.is_set():
            break
        print(f"[{name}] exited with code {p.exitcode}, restarting in 2s...")
        stop_event.wait(2)


def start_watchdogs(demodulators):
    stop_event = threading.Event()
    threads = []
    for target, config, name in demodulators:
        t = threading.Thread(
            target=watchdog,
            args=(target, config, name, stop_event),
            daemon=True,
            name=f"watchdog-{name}",
        )
        t.start()
        threads.append(t)

    def _sig_handler(sig, frame):
        print("\nShutting down...")
        stop_event.set()

    signal.signal(signal.SIGINT, _sig_handler)
    signal.signal(signal.SIGTERM, _sig_handler)

    for t in threads:
        t.join()


def load_config(filename='demodulator_config.json'):
    file_path = os.path.join(SCRIPT_DIR, filename)
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: Configuration file '{filename}' not found at {file_path}")
        return None
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from '{filename}'. Check file formatting.")
        return None


def launch_from_config(config_data):
    hw      = config_data["hack_rf_config"]
    lora_hw = config_data["lora_hack_rf_config"]
    lora    = config_data["lora_demod"]
    telegps = config_data["telegps_demod"]
    zmq     = config_data["zmq_splitter"]

    lora_enabled    = lora.get("enabled", False)
    telegps_enabled = telegps.get("enabled", False)
    zmq_enabled     = zmq.get("enabled", False)

    if lora_enabled and telegps_enabled and not zmq_enabled:
        print("Error: Both lora and telegps are enabled but zmq_splitter is not. "
              "Enable zmq_splitter in the config.")
        sys.exit(1)

    demodulators = []

    if zmq_enabled:
        demodulators.append((run_zmq, {
            "freq":      hw["center_freq"],
            "samp_rate": hw["sample_rate"],
            "bw":        hw["bandwidth"],
            "gain":      hw["gain"],
            "addr0":     zmq["zmq_pub_addr1"],
            "addr1":     zmq["zmq_pub_addr2"],
        }, "zmq_splitter"))

    if lora_enabled:
        demodulators.append((run_lora, {
            "port":             lora["port"],
            "host":             lora["host"],
            "zmq":              zmq_enabled,
            "zmq_addr":         zmq["zmq_pub_addr1"] if zmq_enabled else DEFAULT_ZMQ_ADDR1,
            "center_freq":      lora_hw["center_freq"],
            "bandwidth":        lora_hw["bandwidth"],
            "sample_rate":      lora_hw["sample_rate"],
            "spreading_factor": lora_hw["spreading_factor"],
            "gain":             lora_hw["gain"],
            "payload_len":      lora_hw["payload_len"],
            "sync_word":        int(lora_hw["sync_word"], 0),
        }, "lora_demod"))

    if telegps_enabled:
        zmq_addr = zmq["zmq_pub_addr2"] if lora_enabled else zmq["zmq_pub_addr1"]
        demodulators.append((run_telegps, {
            "addr":       zmq_addr,
            "samp_rate":  telegps["sample_rate"],
            "audio_rate": telegps["audio_rate"],
        }, "telegps_demod"))

    start_watchdogs(demodulators)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-l", "--lora",    help="Launch LoRa demodulator with default settings",    action='store_true')
    ap.add_argument("-t", "--telegps", help="Launch TeleGPS demodulator with default settings", action='store_true')
    ap.add_argument("-c", "--config",  help="Launch using config file (default: demodulator_config.json)",
                    type=str, nargs='?', const='demodulator_config.json')
    args = ap.parse_args()

    if args.config:
        if args.lora or args.telegps:
            print("Error: Cannot use --lora or --telegps with --config.")
            sys.exit(1)
        config_data = load_config(args.config)
        if config_data is None:
            sys.exit(1)
        launch_from_config(config_data)

    elif args.lora and args.telegps:
        start_watchdogs([
            (run_zmq,     {"addr0": DEFAULT_ZMQ_ADDR1, "addr1": DEFAULT_ZMQ_ADDR2}, "zmq_splitter"),
            (run_lora,    {"zmq": True, "zmq_addr": DEFAULT_ZMQ_ADDR1},             "lora_demod"),
            (run_telegps, {"addr": DEFAULT_ZMQ_ADDR2},                              "telegps_demod"),
        ])

    elif args.lora:
        start_watchdogs([(run_lora, {}, "lora_demod")])

    elif args.telegps:
        start_watchdogs([
            (run_zmq,     {"addr0": DEFAULT_ZMQ_ADDR1, "addr1": DEFAULT_ZMQ_ADDR2}, "zmq_splitter"),
            (run_telegps, {"addr": DEFAULT_ZMQ_ADDR1},                              "telegps_demod"),
        ])

    else:
        ap.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
