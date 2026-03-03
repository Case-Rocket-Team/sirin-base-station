#!/usr/bin/env python3
from gnuradio import gr, zeromq, analog, blocks
import argparse, signal, sys

class ZmqIqToDirewolf(gr.top_block):
    def __init__(self, addr, samp_rate, audio_rate=24000, timeout_ms=100):
        gr.top_block.__init__("ZMQ IQ -> NBFM -> Direwolf PCM", catch_exceptions=True)

        self.src = zeromq.sub_source(gr.sizeof_gr_complex, 1, addr, timeout_ms, False, -1)

        # Pick a decimation so quad_rate is reasonable (e.g., 200 kS/s)
        decim = int(samp_rate // 200_000) if samp_rate >= 200_000 else 1
        quad_rate = samp_rate / decim

        self.decim = blocks.keep_one_in_n(gr.sizeof_gr_complex, decim)

        self.nbfm = analog.nbfm_rx(audio_rate=int(audio_rate),quad_rate=quad_rate,tau=75e-6,ax_dev=5e3)

        # float audio [-1,1] -> int16 PCM
        self.scale = blocks.multiply_const_ff(32767.0)
        self.f2s = blocks.float_to_short(1, 1.0)
        self.out = blocks.file_descriptor_sink(gr.sizeof_short, 1)

        self.connect(self.src, self.decim, self.nbfm, self.scale, self.f2s, self.out)

def run(config):
    tb = ZmqIqToDirewolf(
        addr=config.get("addr", "tcp://127.0.0.1:5555"),
        samp_rate=config.get("samp_rate", 2_000_000),
        audio_rate=config.get("audio_rate", 24000),
    )

    def _h(sig, frame):
        tb.stop(); tb.wait(); sys.exit(0)

    signal.signal(signal.SIGINT, _h)
    signal.signal(signal.SIGTERM, _h)
    tb.start()
    signal.pause()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--addr", default="tcp://127.0.0.1:5555", help="ZMQ SUB endpoint")
    ap.add_argument("--samp-rate", type=float, default=2_000_000)
    ap.add_argument("--audio-rate", type=float, default=24000)
    args = ap.parse_args()

    run({
        "addr":       args.addr,
        "samp_rate":  args.samp_rate,
        "audio_rate": args.audio_rate,
    })


if __name__ == "__main__":
    main()