#!/usr/bin/env python3
from gnuradio import gr, soapy, zeromq
import argparse
import signal
import sys


class zmq_splitter(gr.top_block):
    def __init__(
        self,
        center_freq=434.5e6,
        samp_rate=2_000_000,
        bw=125_000,
        gain=20,
        addr0="tcp://127.0.0.1:5555",
        addr1="tcp://127.0.0.1:5556",
        hwm=256,
        timeout=100,  # ms
    ):
        gr.top_block.__init__("HackRF RX -> 2x ZMQ PUB", catch_exceptions=True)

        # Soapy HackRF source
        self.source = soapy.source(
            "driver=hackrf",  # device
            "fc32",           # dtype
            1,                # nchan
            "",               # dev_args
            "",               # stream_args
            [""],             # tune_args
            [""]              # other_settings
        )
        self.source.set_sample_rate(0, samp_rate)
        self.source.set_frequency(0, center_freq)
        self.source.set_bandwidth(0, bw)
        self.source.set_gain(0, gain)

        # Two ZMQ PUB sinks
        self.zmq_pub0 = zeromq.pub_sink(gr.sizeof_gr_complex, 1, addr0, timeout, False, hwm)
        self.zmq_pub1 = zeromq.pub_sink(gr.sizeof_gr_complex, 1, addr1, timeout, False, hwm)

        self.connect((self.source, 0), (self.zmq_pub0, 0))
        self.connect((self.source, 0), (self.zmq_pub1, 0))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--freq", type=float, default=434.5e6)
    p.add_argument("--samp-rate", type=float, default=2_000_000)
    p.add_argument("--bw", type=float, default=125_000)
    p.add_argument("--gain", type=float, default=20)
    p.add_argument("--addr0", type=str, default="tcp://127.0.0.1:5555")
    p.add_argument("--addr1", type=str, default="tcp://127.0.0.1:5556")
    p.add_argument("--hwm", type=int, default=256)
    p.add_argument("--timeout", type=int, default=100)
    args = p.parse_args()

    tb = zmq_splitter(
        center_freq=args.freq,
        samp_rate=args.samp_rate,
        bw=args.bw,
        gain=args.gain,
        addr0=args.addr0,
        addr1=args.addr1,
        hwm=args.hwm,
        timeout=args.timeout,
    )

    def _sig_handler(sig, frame):
        tb.stop()
        tb.wait()
        sys.exit(0)

    signal.signal(signal.SIGINT, _sig_handler)
    signal.signal(signal.SIGTERM, _sig_handler)

    tb.start()
    print("Streaming HackRF IQ -> ZMQ PUB:")
    print(f"  #0: {args.addr0}")
    print(f"  #1: {args.addr1}")
    signal.pause()


if __name__ == "__main__":
    main()