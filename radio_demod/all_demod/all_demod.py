#!/usr/bin/env python3
"""
HackRF (or upstream ZMQ) -> [LoRa demod -> websocket broadcast] + [2x ZMQ PUB sinks]
Cross-platform: works on Linux/WSL and Windows (radioconda).
"""

from gnuradio import gr, blocks, soapy, zeromq
import gnuradio.lora_sdr as lora_sdr
from websockets.asyncio.server import serve, broadcast
import argparse
import asyncio
import numpy as np
import signal
import sys
import threading


class lora_rx_with_split(gr.top_block):
    def __init__(
        self,
        use_zmq=False,
        zmq_in_addr="tcp://127.0.0.1:5555",
        center_freq=434.5e6,
        samp_rate=2_000_000,
        bw=125_000,
        gain=20,
        sf=7,
        pay_len=256,
        sync_word=0x12,
        enable_pub=True,
        pub_addr0="tcp://127.0.0.1:5555",
        pub_addr1="tcp://127.0.0.1:5556",
        pub_hwm=256,
        pub_timeout=100,
    ):
        gr.top_block.__init__(self, "HackRF Splitter + LoRa RX", catch_exceptions=True)

        soft_decoding = True
        cr = 1
        impl_head = False
        has_crc = False

        # ---------- Source ----------
        if use_zmq:
            self.source = zeromq.sub_source(
                gr.sizeof_gr_complex, 1, zmq_in_addr, 100, False, -1
            )
        else:
            self.source = soapy.source(
                "driver=hackrf", "fc32", 1, "", "", [""], [""]
            )
            self.source.set_sample_rate(0, samp_rate)
            self.source.set_frequency(0, center_freq)
            self.source.set_bandwidth(0, bw)
            self.source.set_gain(0, gain)
            self.source.set_min_output_buffer(
                int(np.ceil(samp_rate / bw * (2 ** sf + 2)))
            )

        # ---------- LoRa demod chain ----------
        self.frame_sync = lora_sdr.frame_sync(
            int(center_freq), bw, sf, impl_head,
            [sync_word], int(samp_rate / bw), 8,
        )
        self.fft_demod = lora_sdr.fft_demod(soft_decoding, True)
        self.gray_mapping = lora_sdr.gray_mapping(soft_decoding)
        self.deinterleaver = lora_sdr.deinterleaver(soft_decoding)
        self.hamming_dec = lora_sdr.hamming_dec(soft_decoding)
        self.header_decoder = lora_sdr.header_decoder(
            impl_head, cr, pay_len, has_crc, False, True
        )
        self.dewhitening = lora_sdr.dewhitening()
        self.crc_verif = lora_sdr.crc_verif(2, True)
        self.msg_debug = blocks.message_debug()

        self.msg_connect((self.header_decoder, 'frame_info'),
                         (self.frame_sync, 'frame_info'))
        self.msg_connect((self.crc_verif, 'msg'),
                         (self.msg_debug, 'print'))

        self.connect((self.source, 0),         (self.frame_sync, 0))
        self.connect((self.frame_sync, 0),     (self.fft_demod, 0))
        self.connect((self.fft_demod, 0),      (self.gray_mapping, 0))
        self.connect((self.gray_mapping, 0),   (self.deinterleaver, 0))
        self.connect((self.deinterleaver, 0),  (self.hamming_dec, 0))
        self.connect((self.hamming_dec, 0),    (self.header_decoder, 0))
        self.connect((self.header_decoder, 0), (self.dewhitening, 0))
        self.connect((self.dewhitening, 0),    (self.crc_verif, 0))

        # ---------- ZMQ PUB sinks ----------
        self.zmq_pub0 = None
        self.zmq_pub1 = None
        if enable_pub:
            self.zmq_pub0 = zeromq.pub_sink(
                gr.sizeof_gr_complex, 1, pub_addr0, pub_timeout, False, pub_hwm
            )
            self.zmq_pub1 = zeromq.pub_sink(
                gr.sizeof_gr_complex, 1, pub_addr1, pub_timeout, False, pub_hwm
            )
            self.connect((self.source, 0), (self.zmq_pub0, 0))
            self.connect((self.source, 0), (self.zmq_pub1, 0))


class byte_recv_callback(gr.sync_block):
    """Sink block that fires a Python callback for every arriving byte chunk."""
    def __init__(self, callback):
        gr.sync_block.__init__(
            self, name="CallbackBytesSink",
            in_sig=[np.uint8], out_sig=None
        )
        self.cb = callback

    def work(self, input_items, output_items):
        new_bytes = input_items[0]
        if len(new_bytes) > 0:
            self.cb(new_bytes)
        return len(new_bytes)


def run(config):
    clients = set()

    async def handle_conn(socket):
        clients.add(socket)
        try:
            await socket.wait_closed()
        finally:
            clients.remove(socket)

    async def start_ws():
        host = config["host"]
        port = config["port"]
        async with serve(handle_conn, host, port) as server:
            print(f"Websocket opened on ws://{host}:{port}")
            await server.serve_forever()

    threading.Thread(target=lambda: asyncio.run(start_ws()), daemon=True).start()

    tb = lora_rx_with_split(
        use_zmq=config["zmq"],
        zmq_in_addr=config["zmq_in_addr"],
        center_freq=config["center_freq"],
        samp_rate=config["sample_rate"],
        bw=config["bandwidth"],
        gain=config["gain"],
        sf=config["spreading_factor"],
        pay_len=config["payload_len"],
        sync_word=config["sync_word"],
        enable_pub=config["enable_pub"],
        pub_addr0=config["pub_addr0"],
        pub_addr1=config["pub_addr1"],
        pub_hwm=config["pub_hwm"],
        pub_timeout=config["pub_timeout"],
    )

    sink = byte_recv_callback(lambda msg: broadcast(clients, bytes(msg)))
    tb.connect((tb.crc_verif, 0), (sink, 0))

    # ---------- Cross-platform shutdown handling ----------
    def _sig(sig, frame):
        # Raise KeyboardInterrupt in the main thread so tb.wait() unblocks
        raise KeyboardInterrupt()

    signal.signal(signal.SIGINT, _sig)
    # SIGTERM on Windows is not deliverable the same way; only register on POSIX
    if sys.platform != "win32" and hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, _sig)

    tb.start()
    print("Listening for LoRa packets...")
    if config["enable_pub"] and not config["zmq"]:
        print(f"Publishing IQ to: {config['pub_addr0']}  and  {config['pub_addr1']}")

    try:
        tb.wait()              # blocks until the flowgraph stops or Ctrl+C
    except KeyboardInterrupt:
        print("\nShutting down...")
        tb.stop()
        tb.wait()
        sys.exit(0)


def main():
    p = argparse.ArgumentParser("hackrf_split_lora_rx")
    # Source
    p.add_argument("--zmq", action="store_true",
                   help="Use ZMQ SUB as source instead of opening the HackRF")
    p.add_argument("--zmq-addr", dest="zmq_in_addr",
                   default="tcp://127.0.0.1:5555",
                   help="ZMQ SUB endpoint to connect to (used with --zmq)")
    # RF
    p.add_argument("--center-freq",  type=float, default=434.5e6)
    p.add_argument("--bandwidth",    type=int,   default=125_000)
    p.add_argument("--sample-rate",  type=int,   default=2_000_000)
    p.add_argument("--gain",         type=int,   default=20)
    # LoRa
    p.add_argument("--spreading-factor", type=int, default=7)
    p.add_argument("--payload-len",      type=int, default=256)
    p.add_argument("--sync-word", type=lambda x: int(x, 0), default=0x12)
    # Websocket
    p.add_argument("--host", type=str, default="localhost")
    p.add_argument("--port", type=int, default=8765)
    # ZMQ PUB outputs
    p.add_argument("--no-pub", action="store_true",
                   help="Disable the local ZMQ PUB outputs")
    p.add_argument("--pub-addr0",   default="tcp://127.0.0.1:5555")
    p.add_argument("--pub-addr1",   default="tcp://127.0.0.1:5556")
    p.add_argument("--pub-hwm",     type=int, default=256)
    p.add_argument("--pub-timeout", type=int, default=100)

    args = p.parse_args()

    enable_pub = not args.no_pub and not args.zmq

    run({
        "zmq":              args.zmq,
        "zmq_in_addr":      args.zmq_in_addr,
        "center_freq":      args.center_freq,
        "bandwidth":        args.bandwidth,
        "sample_rate":      args.sample_rate,
        "gain":             args.gain,
        "spreading_factor": args.spreading_factor,
        "payload_len":      args.payload_len,
        "sync_word":        args.sync_word,
        "host":             args.host,
        "port":             args.port,
        "enable_pub":       enable_pub,
        "pub_addr0":        args.pub_addr0,
        "pub_addr1":        args.pub_addr1,
        "pub_hwm":          args.pub_hwm,
        "pub_timeout":      args.pub_timeout,
    })


if __name__ == "__main__":
    main()