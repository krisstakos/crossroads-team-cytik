#!/usr/bin/env python3
"""Synthesises the temp R&B score and the sound cues for an animatic. Standard library only.

Usage: make-score.py <events.json> <out.wav>
events.json: {"length": 120, "events": [{"type": "groove-on|groove-off|chime|ding|vwoop", "t": seconds}, ...]}

This is a placeholder so the animatics have sound. Replace it with an original or licensed R&B cue for the real film.
"""
import json
import math
import random
import struct
import sys
import wave

SR = 22050
BPM = 84.0
BEAT = 60.0 / BPM
BAR = BEAT * 4
LOOP_BARS = 4
LOOP = BAR * LOOP_BARS
random.seed(7)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12.0)


def add(buf, start, samples, gain=1.0):
    i0 = int(start * SR)
    for k, v in enumerate(samples):
        i = i0 + k
        if 0 <= i < len(buf):
            buf[i] += v * gain


def rhodes(freq, dur, vel=1.0):
    n = int(dur * SR)
    out = []
    for k in range(n):
        t = k / SR
        env = min(1.0, t / 0.006) * math.exp(-t * 2.4)
        bell = math.exp(-t * 9.0)  # bright attack that mellows quickly
        s = (math.sin(2 * math.pi * freq * t)
             + 0.45 * bell * math.sin(2 * math.pi * freq * 2 * t)
             + 0.18 * bell * math.sin(2 * math.pi * freq * 4.01 * t)
             + 0.12 * math.sin(2 * math.pi * freq * 3 * t) * math.exp(-t * 4))
        trem = 1.0 + 0.08 * math.sin(2 * math.pi * 4.8 * t)
        out.append(s * env * trem * vel)
    return out


def bass(freq, dur, vel=1.0):
    n = int(dur * SR)
    out = []
    for k in range(n):
        t = k / SR
        env = min(1.0, t / 0.01) * math.exp(-t * 3.2)
        out.append((math.sin(2 * math.pi * freq * t) + 0.28 * math.sin(2 * math.pi * freq * 2 * t)) * env * vel)
    return out


def kick(vel=1.0):
    n = int(0.28 * SR)
    out = []
    phase = 0.0
    for k in range(n):
        t = k / SR
        f = 45 + 95 * math.exp(-t * 26)
        phase += 2 * math.pi * f / SR
        out.append(math.sin(phase) * math.exp(-t * 11) * vel)
    return out


def snap(vel=1.0):
    n = int(0.11 * SR)
    out = []
    prev = 0.0
    for k in range(n):
        t = k / SR
        x = random.uniform(-1, 1)
        hp = x - prev  # crude high-pass: bright, clicky
        prev = x
        out.append((hp * 0.9 + 0.35 * math.sin(2 * math.pi * 1900 * t)) * math.exp(-t * 55) * vel)
    return out


def hat(vel=1.0):
    n = int(0.05 * SR)
    out = []
    prev = 0.0
    for k in range(n):
        t = k / SR
        x = random.uniform(-1, 1)
        hp = x - prev
        prev = x
        out.append(hp * math.exp(-t * 110) * vel)
    return out


# Dm9 | G13 | Cmaj9 | Am9 (voicings as MIDI notes), roots for the bass
CHORDS = [
    ([50, 53, 57, 60, 64], 38),   # Dm9  (root D2)
    ([53, 59, 64, 55, 62], 43),   # G13  (root G2)
    ([52, 55, 59, 62, 67], 36),   # Cmaj9(root C2)
    ([55, 60, 64, 59, 62], 45),   # Am9  (root A2)
]


def build_loop():
    buf = [0.0] * int(LOOP * SR)
    swing = 0.12 * BEAT / 2
    for b, (voicing, root) in enumerate(CHORDS):
        t0 = b * BAR
        # Rhodes comping: long hit on 1, short on the "and" of 2, stab on 4
        for when, dur, vel in ((0.0, 1.7, 0.9), (1.5 * BEAT + swing, 0.5, 0.65), (3.0 * BEAT, 0.6, 0.7)):
            for j, n in enumerate(voicing):
                add(buf, t0 + when + j * 0.012, rhodes(midi(n), dur, vel), 0.075)
        # bass
        for when, dur, vel in ((0.0, 0.9, 1.0), (1.5 * BEAT + swing, 0.5, 0.8), (2.5 * BEAT, 0.5, 0.7), (3.5 * BEAT + swing, 0.35, 0.8)):
            add(buf, t0 + when, bass(midi(root), dur, vel), 0.38)
        # drums
        add(buf, t0, kick(), 0.55)
        add(buf, t0 + 1.5 * BEAT + swing, kick(), 0.4)
        add(buf, t0 + 1 * BEAT, snap(), 0.30)
        add(buf, t0 + 3 * BEAT, snap(), 0.30)
        for h in range(8):
            off = h * BEAT / 2 + (swing if h % 2 else 0)
            add(buf, t0 + off, hat(), 0.10 if h % 2 else 0.14)
    return buf


def bell(freq, dur, vel=1.0):
    n = int(dur * SR)
    out = []
    for k in range(n):
        t = k / SR
        env = min(1.0, t / 0.004) * math.exp(-t * 3.4)
        out.append((math.sin(2 * math.pi * freq * t) + 0.4 * math.sin(2 * math.pi * freq * 2.76 * t) * math.exp(-t * 5)) * env * vel)
    return out


def sweep(f0, f1, dur, vel=1.0):
    n = int(dur * SR)
    out = []
    phase = 0.0
    for k in range(n):
        t = k / n
        f = f0 + (f1 - f0) * t
        phase += 2 * math.pi * f / SR
        env = math.sin(math.pi * t) ** 1.5
        out.append((math.sin(phase) * 0.7 + random.uniform(-1, 1) * 0.25) * env * vel)
    return out


def main():
    events_path, out_path = sys.argv[1], sys.argv[2]
    data = json.load(open(events_path))
    length = float(data["length"])
    events = sorted(data["events"], key=lambda e: e["t"])
    mix = [0.0] * int(length * SR)
    loop = build_loop()
    loop_len = len(loop)

    # groove windows: copy the loop in, with 0.4 s fades at each edge
    windows, start = [], None
    for e in events:
        if e["type"] == "groove-on" and start is None:
            start = e["t"]
        elif e["type"] == "groove-off" and start is not None:
            windows.append((start, e["t"]))
            start = None
    if start is not None:
        windows.append((start, length))
    fade = 0.4
    for a, b in windows:
        i0, i1 = int(a * SR), min(len(mix), int(b * SR))
        for i in range(i0, i1):
            t = (i - i0) / SR
            env = min(1.0, t / fade, (b - a - t) / fade if b - a > fade else 1.0)
            mix[i] += loop[(i - i0) % loop_len] * max(0.0, env)

    for e in events:
        t = e["t"]
        if e["type"] == "chime":  # the two-note chime: E6 then A6
            add(mix, t, bell(1318.5, 1.6), 0.30)
            add(mix, t + 0.18, bell(1760.0, 1.8), 0.30)
        elif e["type"] == "ding":
            add(mix, t, bell(2093.0, 1.0), 0.22)
        elif e["type"] == "vwoop":
            add(mix, t, sweep(1500, 160, 0.9), 0.32)

    peak = max(1e-9, max(abs(v) for v in mix))
    scale = 0.89 / peak
    with wave.open(out_path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1.0, min(1.0, v * scale)) * 32767)) for v in mix))
    print("wrote", out_path)


if __name__ == "__main__":
    main()
