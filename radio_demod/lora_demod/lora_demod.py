#!/usr/bin/env python3
from gnuradio import soapy, gr, blocks
import signal
import numpy as np
import gnuradio.lora_sdr as lora_sdr
import sys
import asyncio
from websockets.asyncio.server import serve, broadcast
import threading
import argparse
from gnuradio import zeromq

class lora_rx(gr.top_block):
    def __init__(self, zmq, zmq_addr="tcp://127.0.0.1:5555",
                 center_freq=434.5e6, bw=125_000, samp_rate=2_000_000,
                 sf=7, gain=20, pay_len=256, sync_word=0x12):
        gr.top_block.__init__(self, "Lora Rx (HackRF via Soapy)", catch_exceptions=True)

        ##################################################
        # Variables
        ##################################################
        self.soft_decoding = soft_decoding = True
        self.sf = sf = sf
        self.center_freq = center_freq = center_freq
        self.bw = bw = bw
        self.samp_rate = samp_rate = samp_rate
        self.cr = cr = 1
        self.impl_head = impl_head = False
        self.has_crc = has_crc = False
        self.pay_len = pay_len = pay_len
        self.sync_word = sync_word = sync_word

        ##################################################
        # Source: either HackRF (Soapy) or ZMQ
        ##################################################
        if zmq == True:
            # ZMQ SUB source
            # Pick the endpoint for this script (e.g. 5555 or 5556)
            self.source = zeromq.sub_source(
                gr.sizeof_gr_complex,   # itemsize
                1,                      # vlen
                zmq_addr,               # zmq endpoint to sub to
                100,                    # timeout ms
                False,                  # pass_tags
                -1                      # hwm (-1 = default)
            )
        else:
            device = "driver=hackrf"
            dtype = "fc32"
            nchan = 1
            dev_args = ""
            stream_args = ""
            tune_args = [""]
            other_settings = [""]

            self.source = soapy.source(device, dtype, nchan, dev_args, stream_args, tune_args, other_settings)
            self.source.set_sample_rate(0, samp_rate)
            self.source.set_frequency(0, center_freq)
            self.source.set_bandwidth(0, bw)
            self.source.set_gain(0, gain)
            self.source.set_min_output_buffer(int(np.ceil(samp_rate / bw * (2**sf + 2))))

        ##################################################
        # LoRa SDR blocks
        ##################################################
        self.lora_sdr_header_decoder_0 = lora_sdr.header_decoder(impl_head, cr, pay_len, has_crc, False, True)
        self.lora_sdr_hamming_dec_0 = lora_sdr.hamming_dec(soft_decoding)
        self.lora_sdr_gray_mapping_0 = lora_sdr.gray_mapping(soft_decoding)
        self.lora_sdr_frame_sync_0 = lora_sdr.frame_sync(int(center_freq), bw, sf, impl_head, [sync_word], int(samp_rate / bw), 8)
        self.lora_sdr_fft_demod_0 = lora_sdr.fft_demod(soft_decoding, True)
        self.lora_sdr_dewhitening_0 = lora_sdr.dewhitening()
        self.lora_sdr_deinterleaver_0 = lora_sdr.deinterleaver(soft_decoding)
        self.lora_sdr_crc_verif_0 = lora_sdr.crc_verif(2, True)
        
        # Added to print packets to terminal
        self.blocks_message_debug_0 = blocks.message_debug()

        ##################################################
        # Connections
        ##################################################
        self.msg_connect((self.lora_sdr_header_decoder_0, 'frame_info'), (self.lora_sdr_frame_sync_0, 'frame_info'))
        
        # Packet Printing Connection
        self.msg_connect((self.lora_sdr_crc_verif_0, 'msg'), (self.blocks_message_debug_0, 'print'))

        self.connect((self.source, 0), (self.lora_sdr_frame_sync_0, 0))
        self.connect((self.lora_sdr_frame_sync_0, 0), (self.lora_sdr_fft_demod_0, 0))
        self.connect((self.lora_sdr_fft_demod_0, 0), (self.lora_sdr_gray_mapping_0, 0))
        self.connect((self.lora_sdr_gray_mapping_0, 0), (self.lora_sdr_deinterleaver_0, 0))
        self.connect((self.lora_sdr_deinterleaver_0, 0), (self.lora_sdr_hamming_dec_0, 0))
        self.connect((self.lora_sdr_hamming_dec_0, 0), (self.lora_sdr_header_decoder_0, 0))
        self.connect((self.lora_sdr_header_decoder_0, 0), (self.lora_sdr_dewhitening_0, 0))
        self.connect((self.lora_sdr_dewhitening_0, 0), (self.lora_sdr_crc_verif_0, 0))
        
class byte_recv_callback(gr.sync_block):
    """
    A sink block that calls a Python function whenever new bytes arrive.
    """
    def __init__(self, callback):
        gr.sync_block.__init__(
            self,
            name="CallbackBytesSink",
            in_sig=[np.uint8],  # 8-bit byte input
            out_sig=None
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
        host = config.get("host", "localhost")
        port = config.get("port", 8765)
        async with serve(handle_conn, host, port) as server:
            print(f"Websocket opened on ws://{host}:{port}")
            await server.serve_forever()

    threading.Thread(target=lambda: asyncio.run(start_ws()), daemon=True).start()

    tb = lora_rx(
        zmq=config.get("zmq", False),
        zmq_addr=config.get("zmq_addr", "tcp://127.0.0.1:5555"),
        center_freq=config.get("center_freq", 434.5e6),
        bw=config.get("bandwidth", 125_000),
        samp_rate=config.get("sample_rate", 2_000_000),
        sf=config.get("spreading_factor", 7),
        gain=config.get("gain", 20),
        pay_len=config.get("payload_len", 256),
        sync_word=config.get("sync_word", 0x12),
    )
    sink = byte_recv_callback(lambda msg: broadcast(clients, bytes(msg)))

    tb.connect((tb.lora_sdr_crc_verif_0, 0), (sink, 0))

    def sig_handler(sig, frame):
        tb.stop()
        tb.wait()
        sys.exit(0)

    signal.signal(signal.SIGINT, sig_handler)
    signal.signal(signal.SIGTERM, sig_handler)

    tb.start()
    print("Listening...")
    signal.pause()


def main():
    parser = argparse.ArgumentParser("lora_demod")
    parser.add_argument("--port", type=int, default=8765, help="Port of the websocket server")
    parser.add_argument("--host", type=str, default="localhost", help="Host of the websocket server")
    parser.add_argument("--zmq", action='store_true', help="Use ZMQ block to listen to published messages")
    parser.add_argument("--zmq-addr", default="tcp://127.0.0.1:5555", help="ZMQ endpoint to SUB connect to")
    parser.add_argument("--center-freq", type=float, default=434.5e6, help="Center frequency in Hz")
    parser.add_argument("--bandwidth", type=int, default=125_000, help="Bandwidth in Hz")
    parser.add_argument("--sample-rate", type=int, default=2_000_000, help="Sample rate in Hz")
    parser.add_argument("--spreading-factor", type=int, default=7, help="LoRa spreading factor")
    parser.add_argument("--gain", type=int, default=20, help="HackRF gain")
    parser.add_argument("--payload-len", type=int, default=256, help="Payload length")
    parser.add_argument("--sync-word", type=lambda x: int(x, 0), default=0x12, help="LoRa sync word (e.g. 0x12)")
    args = parser.parse_args()

    run({
        "port":             args.port,
        "host":             args.host,
        "zmq":              args.zmq,
        "zmq_addr":         args.zmq_addr,
        "center_freq":      args.center_freq,
        "bandwidth":        args.bandwidth,
        "sample_rate":      args.sample_rate,
        "spreading_factor": args.spreading_factor,
        "gain":             args.gain,
        "payload_len":      args.payload_len,
        "sync_word":        args.sync_word,
    })


if __name__ == "__main__":
    main()
