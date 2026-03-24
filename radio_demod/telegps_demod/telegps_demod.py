#!/usr/bin/env python3
from gnuradio import gr, zeromq, analog, blocks, filter as grfilter
import argparse, signal, sys, os, subprocess

class ZmqIqToDirewolf(gr.top_block):
    def __init__(self, addr, samp_rate, audio_rate=24000, freq_offset=0, timeout_ms=100, out_fd=1):
        gr.top_block.__init__("ZMQ IQ -> NBFM -> Direwolf PCM", catch_exceptions=True)

        self.src = zeromq.sub_source(gr.sizeof_gr_complex, 1, addr, timeout_ms, False, -1)

        # Pick a decimation so quad_rate is reasonable (e.g., 200 kS/s)
        decim = int(samp_rate // 200_000) if samp_rate >= 200_000 else 1
        quad_rate = samp_rate / decim

        # Shift freq_offset to baseband and decimate in one block
        taps = grfilter.firdes.low_pass(1.0, samp_rate, quad_rate / 2, quad_rate / 4)
        self.xlate = grfilter.freq_xlating_fir_filter_ccc(decim, taps, freq_offset, samp_rate)

        self.nbfm = analog.nbfm_rx(audio_rate=int(audio_rate),quad_rate=quad_rate,tau=75e-6,ax_dev=5e3)

        # float audio [-1,1] -> int16 PCM
        self.scale = blocks.multiply_const_ff(32767.0)
        self.f2s = blocks.float_to_short(1, 1.0)
        self.out = blocks.file_descriptor_sink(gr.sizeof_short, out_fd)

        self.connect(self.src, self.xlate, self.nbfm, self.scale, self.f2s, self.out)

_PIPE_CMD = 'direwolf -n 1 -r 24000 -b 16 -L "log/$(date)/tele-gps.csv" - | tee >(ts -s > "log/$(date)/raw/tele-gps-direwolf.log")'

def run(config):
    read_fd, write_fd = os.pipe()
    p_bash = subprocess.Popen(_PIPE_CMD, stdin=read_fd, shell=True, executable='/bin/bash')
    os.close(read_fd)

    top_block = ZmqIqToDirewolf(
        addr=config.get("addr", "tcp://127.0.0.1:5555"),
        samp_rate=config.get("samp_rate", 2_000_000),
        audio_rate=config.get("audio_rate", 24000),
        freq_offset=config.get("freq_offset", 0),
        out_fd=write_fd,
    )

    def _sig_handler(sig, frame):
        top_block.stop()
        top_block.wait()
        os.close(write_fd)
        p_bash.wait()
        sys.exit(0)

    signal.signal(signal.SIGINT, _sig_handler)
    signal.signal(signal.SIGTERM, _sig_handler)
    top_block.start()
    signal.pause()


def main():
    arg_parser = argparse.ArgumentParser()
    arg_parser.add_argument("--addr", default="tcp://127.0.0.1:5555", help="ZMQ SUB endpoint")
    arg_parser.add_argument("--samp-rate", type=float, default=2_000_000)
    arg_parser.add_argument("--audio-rate", type=float, default=24000)
    arg_parser.add_argument("--freq-offset", type=float, default=0, help="Frequency offset from HackRF center in Hz")
    args = arg_parser.parse_args()

    run({
        "addr":        args.addr,
        "samp_rate":   args.samp_rate,
        "audio_rate":  args.audio_rate,
        "freq_offset": args.freq_offset,
    })


if __name__ == "__main__":
    main()