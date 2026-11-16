#!/usr/bin/env python3
import os
import queue
import signal
import socket
import struct
import subprocess
import sys
import threading

import numpy as np
import zmq

# ---------------------------------------------------------------------------
# Mode: rtl_tcp  (raw IQ -> uint8 interleaved -> rtl_tcp server for SDR#)
# ---------------------------------------------------------------------------

# Dongle info header: magic "RTL0" + tuner type R820T (5) + gain count (29)
_DONGLE_INFO = b'RTL0' + struct.pack('>II', 5, 29)


def _handle_rtl_tcp_client(conn, addr, data_queue):
    """Send rtl_tcp dongle header then stream IQ chunks from data_queue."""
    print(f"[rtl_tcp] Client connected: {addr}")
    try:
        conn.sendall(_DONGLE_INFO)

        # Drain incoming commands (SET_FREQ, SET_GAIN, etc.) in a background
        # thread so they don't block the send path.  We ignore them because
        # we cannot retune the HackRF from here.
        def _drain():
            try:
                while True:
                    if not conn.recv(5):
                        break
            except OSError:
                pass
        threading.Thread(target=_drain, daemon=True).start()

        while True:
            chunk = data_queue.get(timeout=5.0)
            if chunk is None:
                break
            conn.sendall(chunk)
    except (OSError, BrokenPipeError):
        pass
    finally:
        conn.close()
        print(f"[rtl_tcp] Client disconnected: {addr}")


def run_rtl_tcp(config):
    zmq_addr  = config.get("addr",          "tcp://127.0.0.1:5555")
    host      = config.get("rtl_tcp_host",  "0.0.0.0")
    port      = int(config.get("rtl_tcp_port", 1234))

    client_queues: list[queue.Queue] = []
    queues_lock = threading.Lock()

    # --- ZMQ reader thread ---------------------------------------------------
    def _zmq_reader():
        ctx = zmq.Context()
        sock = ctx.socket(zmq.SUB)
        sock.connect(zmq_addr)
        sock.setsockopt_string(zmq.SUBSCRIBE, "")
        sock.setsockopt(zmq.RCVTIMEO, 200)

        while True:
            try:
                raw = sock.recv()
            except zmq.Again:
                continue

            # complex64 -> interleaved uint8 (center 128, range 0-255)
            samples = np.frombuffer(raw, dtype=np.complex64)
            iq = np.empty(len(samples) * 2, dtype=np.uint8)
            iq[0::2] = np.clip(samples.real * 127.5 + 128.0, 0, 255).astype(np.uint8)
            iq[1::2] = np.clip(samples.imag * 127.5 + 128.0, 0, 255).astype(np.uint8)
            chunk = iq.tobytes()

            with queues_lock:
                for q in client_queues[:]:
                    try:
                        q.put_nowait(chunk)
                    except queue.Full:
                        pass  # slow client — drop chunk rather than block

    threading.Thread(target=_zmq_reader, daemon=True, name="rtl_tcp_zmq").start()

    # --- TCP server ----------------------------------------------------------
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((host, port))
    server.listen(5)
    print(f"[rtl_tcp] Listening on {host}:{port}  (connect SDR# here)")

    def _sig_handler(sig, frame):
        server.close()
        sys.exit(0)

    signal.signal(signal.SIGINT, _sig_handler)
    signal.signal(signal.SIGTERM, _sig_handler)

    while True:
        try:
            conn, addr = server.accept()
        except OSError:
            break

        q: queue.Queue = queue.Queue(maxsize=50)
        with queues_lock:
            client_queues.append(q)

        def _client_thread(conn=conn, addr=addr, q=q):
            _handle_rtl_tcp_client(conn, addr, q)
            with queues_lock:
                if q in client_queues:
                    client_queues.remove(q)

        threading.Thread(target=_client_thread, daemon=True).start()


def main():
    import argparse
    arg_parser = argparse.ArgumentParser()
    arg_parser.add_argument("--addr",          default="tcp://127.0.0.1:5555", help="ZMQ SUB endpoint")
    arg_parser.add_argument("--rtl-tcp-host",  default="0.0.0.0",              help="rtl_tcp bind host")
    arg_parser.add_argument("--rtl-tcp-port",  type=int, default=1234,         help="rtl_tcp bind port")
    args = arg_parser.parse_args()

    run_rtl_tcp({
        "addr":          args.addr,
        "rtl_tcp_host":  args.rtl_tcp_host,
        "rtl_tcp_port":  args.rtl_tcp_port,
    })


if __name__ == "__main__":
    main()
