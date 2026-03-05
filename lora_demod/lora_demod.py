from gnuradio import soapy, gr
import signal
import numpy as np
import gnuradio.lora_sdr as lora_sdr
import sys
import asyncio
from websockets.asyncio.server import serve, broadcast
import threading
import argparse

class lora_rx(gr.top_block):
    def __init__(self):
        gr.top_block.__init__(self, "Lora Rx (HackRF via Soapy)", catch_exceptions=True)

        ##################################################
        # Variables
        ##################################################
        self.soft_decoding = soft_decoding = True
        self.sf = sf = 7
        self.center_freq = center_freq = 434.5e6
        self.bw = bw = 125_000
        self.samp_rate = samp_rate = 2_000_000
        self.cr = cr = 1
        self.impl_head = impl_head = False
        self.has_crc = has_crc = False
        self.pay_len = pay_len = 256
        self.sync_word = sync_word = 0x12

        ##################################################
        # Soapy HackRF Source
        ##################################################
        device = "driver=hackrf"
        dtype = "fc32"
        nchan = 1
        dev_args = ""
        stream_args = ""
        tune_args = [""]
        other_settings = [""]
        
        self.soapy_source_0 = soapy.source(device, dtype, nchan, dev_args, stream_args, tune_args, other_settings)
        self.soapy_source_0.set_sample_rate(0, samp_rate)
        self.soapy_source_0.set_frequency(0, center_freq)
        self.soapy_source_0.set_bandwidth(0, bw)
        self.soapy_source_0.set_gain(0, 20)
        self.soapy_source_0.set_min_output_buffer(int(np.ceil(samp_rate / bw * (2**sf + 2))))

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
        #self.blocks_message_debug_0 = blocks.message_debug()

        ##################################################
        # Connections
        ##################################################
        self.msg_connect((self.lora_sdr_header_decoder_0, 'frame_info'), (self.lora_sdr_frame_sync_0, 'frame_info'))
        
        # Packet Printing Connection
        #self.msg_connect((self.lora_sdr_crc_verif_0, 'msg'), (self.blocks_message_debug_0, 'print'))

        self.connect((self.soapy_source_0, 0), (self.lora_sdr_frame_sync_0, 0))
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


def main():
    parser = argparse.ArgumentParser("lora_demod")
    parser.add_argument("--port", help="Port of the websocket server, default 8765", type=int, default=8765)
    parser.add_argument("--host", help="Host of the websocket server, default localhost", type=str, default="localhost")
    args = parser.parse_args()

    clients = set()

    async def handle_conn(socket):
        clients.add(socket)
        try:
            await socket.wait_closed()
        finally:
            clients.remove(socket)

    async def start():
        async with serve(handle_conn, args.host, args.port) as server:
            print(f"Websocket opened on ws://{args.host}:{args.port}")
            await server.serve_forever()
    
    threading.Thread(target=lambda: asyncio.run(start()), daemon=True).start()
    
    tb = lora_rx()
    sink = byte_recv_callback(lambda msg: broadcast(clients, bytes(msg)))

    tb.connect(
        (tb.lora_sdr_crc_verif_0, 0),
        (sink, 0)
    )
    
    def sig_handler():
        tb.stop()
        tb.wait()
        sys.exit(0)

    signal.signal(signal.SIGINT, sig_handler)
    signal.signal(signal.SIGTERM, sig_handler)

    tb.start()
    print("Listening...")
    while True:
        input("")

if __name__ == "__main__":
    main()
