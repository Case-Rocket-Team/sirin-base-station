#!/usr/bin/env python3
"""
SDRplay RSP1a (or upstream ZMQ) -> [LoRa demod -> websocket broadcast] + [2x ZMQ PUB sinks]
Cross-platform: works on Linux, macOS, and Windows.
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


class sdrplay_lora_rx(gr.top_block):
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
        gr.top_block.__init__(self, "SDRplay Splitter + LoRa RX", catch_exceptions=True)

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
                "driver=sdrplay", "fc32", 1, "", "", [""], [""]
            )
            self.source.set_antenna(0, "RX")
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

    # FIX 1: was incorrectly named lora_rx_with_split
    tb = sdrplay_lora_rx(
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

    def _sig(sig, frame):
        raise KeyboardInterrupt()

    signal.signal(signal.SIGINT, _sig)
    if sys.platform != "win32" and hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, _sig)

    tb.start()
    print("Listening for LoRa packets via SDRplay...")

    try:
        tb.wait()
    except KeyboardInterrupt:
        print("\nShutting down...")
        tb.stop()
        tb.wait()
        sys.exit(0)


# FIX 2: main block was missing entirely — script had no entry point
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SDRplay LoRa RX -> WebSocket")

    parser.add_argument("--zmq", action="store_true", help="Use ZMQ input instead of SDRplay")
    parser.add_argument("--zmq-in-addr", default="tcp://127.0.0.1:5555")
    parser.add_argument("--center-freq", type=float, default=434.5e6)
    parser.add_argument("--sample-rate", type=float, default=2_000_000)
    parser.add_argument("--bandwidth", type=float, default=125_000)
    parser.add_argument("--gain", type=float, default=20)
    parser.add_argument("--spreading-factor", type=int, default=7)
    parser.add_argument("--payload-len", type=int, default=256)
    parser.add_argument("--sync-word", type=lambda x: int(x, 0), default=0x12)
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--enable-pub", action="store_true", default=True)
    parser.add_argument("--pub-addr0", default="tcp://127.0.0.1:5555")
    parser.add_argument("--pub-addr1", default="tcp://127.0.0.1:5556")
    parser.add_argument("--pub-hwm", type=int, default=256)
    parser.add_argument("--pub-timeout", type=int, default=100)

    args = parser.parse_args()

    config = {
        "zmq": args.zmq,
        "zmq_in_addr": args.zmq_in_addr,
        "center_freq": args.center_freq,
        "sample_rate": args.sample_rate,
        "bandwidth": args.bandwidth,
        "gain": args.gain,
        "spreading_factor": args.spreading_factor,
        "payload_len": args.payload_len,
        "sync_word": args.sync_word,
        "host": args.host,
        "port": args.port,
        "enable_pub": args.enable_pub,
        "pub_addr0": args.pub_addr0,
        "pub_addr1": args.pub_addr1,
        "pub_hwm": args.pub_hwm,
        "pub_timeout": args.pub_timeout,
    }

    run(config)