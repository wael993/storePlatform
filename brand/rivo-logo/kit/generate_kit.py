#!/usr/bin/env python3
"""Rivo kit masters: symbol, small-size, reversed, lockups, colour."""
from __future__ import annotations

import math
from pathlib import Path

OUT = Path(__file__).resolve().parent
FILL = "#111111"
CURRENT = "#176560"


def f(n: float) -> str:
    v = round(float(n), 1)
    return str(int(v)) if v == int(v) else f"{v:.1f}"


def svg(vb, title, body, w=None, h=None):
    W, H = vb
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(W)} {f(H)}"'
        f' width="{w or int(round(W))}" height="{h or int(round(H))}"'
        f' role="img" aria-labelledby="title">\n'
        f'  <title id="title">{title}</title>\n'
        f"{body}"
        f"</svg>\n"
    )


def channel_path(s, u, bar, ch, right_stem):
    x_right = s + u - right_stem
    x_vert = x_right - ch
    y_top = s + bar
    y_in = y_top + ch
    y_out = s + u - bar - ch
    y_bot = s + u - bar
    gamma = (
        f"M {f(s)} {f(s)} H {f(s + u)} "
        f"V {f(y_out)} H {f(x_right)} "
        f"V {f(y_top)} H {f(s)} Z"
    )
    ell = (
        f"M {f(s)} {f(y_in)} H {f(x_vert)} "
        f"V {f(y_bot)} H {f(s + u)} "
        f"V {f(s + u)} H {f(s)} Z"
    )
    return gamma + " " + ell


def symbol(title, fill, s=32, u=192, bar=32, ch=40, right_stem=80):
    d = channel_path(s, u, bar, ch, right_stem)
    body = (
        f'  <g id="symbol">\n'
        f'    <path fill="{fill}" d="{d}"/>\n'
        f"  </g>\n"
    )
    return svg((256, 256), title, body)


def wordmark_d(stem=26, x_top=92, baseline=196):
    sw = stem
    xh = baseline - x_top
    x = 0.0
    chunks = []

    r_out = 42
    r_in = r_out - sw
    cx, cy = x + sw, x_top + r_out
    term = 16
    chunks.append(
        f"M {f(x)} {f(x_top)} L {f(cx)} {f(x_top)} "
        f"A {f(r_out)} {f(r_out)} 0 0 1 {f(cx + r_out)} {f(cy)} "
        f"L {f(cx + r_out)} {f(cy + term)} "
        f"L {f(cx + r_in)} {f(cy + term)} "
        f"L {f(cx + r_in)} {f(cy)} "
        f"A {f(r_in)} {f(r_in)} 0 0 0 {f(cx)} {f(cy - r_in)} "
        f"L {f(cx)} {f(baseline)} L {f(x)} {f(baseline)} Z"
    )
    x += sw + r_out + 22
    chunks.append(
        f"M {f(x)} {f(44)} h {f(sw)} v {f(20)} h {-sw} Z "
        f"M {f(x)} {f(x_top)} h {f(sw)} v {f(xh)} h {-sw} Z"
    )
    x += sw + 24
    over = 3
    top, bot = x_top, baseline + over
    dy = bot - top
    half_w = dy * math.tan(math.radians(30))
    vw = half_w * 2
    lx, rx = x, x + vw
    apex = x + half_w
    inset = sw / math.sin(math.radians(60))
    inner_bot = bot - sw / math.sin(math.radians(30))
    chunks.append(
        f"M {f(lx)} {f(top)} L {f(lx + inset)} {f(top)} "
        f"L {f(apex)} {f(inner_bot)} L {f(rx - inset)} {f(top)} "
        f"L {f(rx)} {f(top)} L {f(apex)} {f(bot)} Z"
    )
    x += vw + 16
    over_o = 4
    r_out_o = (xh + 2 * over_o) / 2
    r_in_o = r_out_o - sw + 1
    ocx = x + r_out_o
    ocy = x_top - over_o + r_out_o
    chunks.append(
        f"M {f(ocx)} {f(ocy - r_out_o)} "
        f"A {f(r_out_o)} {f(r_out_o)} 0 1 1 {f(ocx)} {f(ocy + r_out_o)} "
        f"A {f(r_out_o)} {f(r_out_o)} 0 1 1 {f(ocx)} {f(ocy - r_out_o)} Z "
        f"M {f(ocx)} {f(ocy - r_in_o)} "
        f"A {f(r_in_o)} {f(r_in_o)} 0 1 0 {f(ocx)} {f(ocy + r_in_o)} "
        f"A {f(r_in_o)} {f(r_in_o)} 0 1 0 {f(ocx)} {f(ocy - r_in_o)} Z"
    )
    x += r_out_o * 2
    return " ".join(chunks), x


def horizontal(fill, title):
    word_d, word_w = wordmark_d()
    pad, sym, gap = 16, 168, 44
    W = math.ceil(pad + sym + gap + word_w + pad)
    inner = (
        f'  <svg x="{pad}" y="44" width="{sym}" height="{sym}" viewBox="0 0 256 256">\n'
        f'    <g id="symbol">\n'
        f'      <path fill="{fill}" d="{channel_path(32, 192, 32, 40, 80)}"/>\n'
        f"    </g>\n"
        f"  </svg>\n"
        f'  <g id="wordmark" transform="translate({pad + sym + gap} 0)">\n'
        f'    <path fill="{fill}" fill-rule="evenodd" d="{word_d}"/>\n'
        f"  </g>\n"
    )
    return svg((W, 256), title, inner, int(round(W)), 256)


def stacked(fill, title):
    word_d, word_w = wordmark_d()
    # Height 256: symbol 112 on top, word scaled into remaining
    W = 280
    sym = 112
    sx = (W - sym) / 2
    word_scale = round(200 / word_w, 3)
    wx = (W - word_w * word_scale) / 2
    wy = 132
    inner = (
        f'  <svg x="{f(sx)}" y="12" width="{sym}" height="{sym}" viewBox="0 0 256 256">\n'
        f'    <path fill="{fill}" d="{channel_path(32, 192, 32, 40, 80)}"/>\n'
        f"  </svg>\n"
        f'  <g id="wordmark" transform="translate({f(wx)} {wy}) scale({word_scale:.4f})">\n'
        f'    <path fill="{fill}" fill-rule="evenodd" d="{word_d}"/>\n'
        f"  </g>\n"
    )
    return svg((W, 256), title, inner, W, 256)


def wordmark_only(fill, title):
    word_d, word_w = wordmark_d()
    W = math.ceil(word_w + 48)
    inner = (
        f'  <g id="wordmark" transform="translate(24 0)">\n'
        f'    <path fill="{fill}" fill-rule="evenodd" d="{word_d}"/>\n'
        f"  </g>\n"
    )
    return svg((W, 256), title, inner, int(round(W)), 256)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = {
        "rivo-symbol.svg": symbol("Rivo symbol — The Channel", FILL),
        "rivo-symbol-small.svg": symbol(
            "Rivo symbol — small-size cut", FILL, s=28, u=200, bar=28, ch=48, right_stem=84
        ),
        "rivo-symbol-reversed.svg": symbol(
            "Rivo symbol — reversed (thinned)", "#ffffff", s=32, u=192, bar=32, ch=44, right_stem=80
        ),
        "rivo-horizontal-current.svg": horizontal(CURRENT, "Rivo logo — horizontal Current"),
        "rivo-stacked-current.svg": stacked(CURRENT, "Rivo logo — stacked Current"),
        "rivo-wordmark-current.svg": wordmark_only(CURRENT, "Rivo wordmark — Current"),
    }
    for name, content in files.items():
        (OUT / name).write_text(content)
    print("wrote", len(files), "masters in", OUT)


if __name__ == "__main__":
    main()
