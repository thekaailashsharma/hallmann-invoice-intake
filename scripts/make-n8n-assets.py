#!/usr/bin/env python3
"""Renders the pictures used in the n8n sticky notes (n8n-assets/). Served by n8n at /static/hallmann/."""
import math, pathlib
from PIL import Image, ImageDraw, ImageFont
OUT = pathlib.Path(__file__).resolve().parent.parent / "n8n-assets"; OUT.mkdir(exist_ok=True)
INK, YEL, BG, MUT, GRN, RED, BLU = (28, 28, 30), (247, 212, 76), (246, 244, 238), (139, 139, 144), (47, 138, 76), (196, 61, 47), (45, 107, 229)
F = lambda s, b=True: ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf" if b else "/System/Library/Fonts/Supplemental/Arial.ttf", s)

def icon(name, draw_fn, bg=YEL):
    S = 4; im = Image.new("RGBA", (120 * S, 120 * S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, 120 * S - 1, 120 * S - 1), radius=30 * S, fill=bg)
    draw_fn(d, S); im.resize((120, 120), Image.LANCZOS).save(OUT / f"{name}.png")
L = lambda d, S, pts, w=7: d.line([(x * S, y * S) for x, y in pts], fill=INK, width=w * S, joint="curve")
R = lambda d, S, b, r=8, w=7, fill=None: d.rounded_rectangle([v * S for v in b], radius=r * S, outline=INK, width=w * S, fill=fill)
E = lambda d, S, b, w=7, fill=None: d.ellipse([v * S for v in b], outline=INK, width=w * S, fill=fill)
icon("mail", lambda d, S: (R(d, S, (24, 34, 96, 86)), L(d, S, [(26, 38), (60, 64), (94, 38)])))
icon("db", lambda d, S: (E(d, S, (28, 26, 92, 44)), L(d, S, [(28, 35), (28, 86)]), L(d, S, [(92, 35), (92, 86)]), d.arc([28 * S, 76 * S, 92 * S, 96 * S], 0, 180, fill=INK, width=7 * S), d.arc([28 * S, 52 * S, 92 * S, 70 * S], 0, 180, fill=INK, width=5 * S)))
icon("label", lambda d, S: (L(d, S, [(30, 30), (66, 30), (92, 60), (66, 90), (30, 90), (30, 30)]), E(d, S, (40, 52, 54, 66), 6)))
icon("handoff", lambda d, S: (L(d, S, [(24, 60), (90, 60)]), L(d, S, [(68, 38), (92, 60), (68, 82)])))
icon("pdf", lambda d, S: (R(d, S, (32, 22, 88, 98), 6), L(d, S, [(44, 50), (76, 50)], 6), L(d, S, [(44, 64), (76, 64)], 6), L(d, S, [(44, 78), (64, 78)], 6)))
icon("shield", lambda d, S: (L(d, S, [(60, 22), (92, 34), (88, 70), (60, 96), (32, 70), (28, 34), (60, 22)]), L(d, S, [(46, 60), (56, 70), (76, 48)])))
icon("ai", lambda d, S: (L(d, S, [(60, 20), (68, 52), (98, 60), (68, 68), (60, 100), (52, 68), (22, 60), (52, 52), (60, 20)], 6)))
icon("rules", lambda d, S: [L(d, S, pts, 7) for pts in ([(26, 36), (34, 44), (46, 30)], [(56, 38), (94, 38)], [(26, 62), (34, 70), (46, 56)], [(56, 64), (94, 64)], [(26, 88), (34, 96), (46, 82)], [(56, 90), (94, 90)])])
icon("stop", lambda d, S: (E(d, S, (26, 26, 94, 94)), L(d, S, [(38, 38), (82, 82)])))
icon("erp", lambda d, S: (R(d, S, (26, 40, 94, 92), 6), L(d, S, [(44, 40), (44, 26), (76, 26), (76, 40)]), L(d, S, [(26, 62), (94, 62)])))
icon("loop", lambda d, S: (d.arc([28 * S, 28 * S, 92 * S, 92 * S], 30, 330, fill=INK, width=7 * S), L(d, S, [(84, 30), (90, 46), (74, 48)])))
icon("person", lambda d, S: (E(d, S, (44, 22, 76, 54)), d.arc([26 * S, 60 * S, 94 * S, 128 * S], 180, 360, fill=INK, width=7 * S)))
icon("bell", lambda d, S: (L(d, S, [(36, 80), (36, 56)]), d.arc([36 * S, 30 * S, 84 * S, 82 * S], 180, 360, fill=INK, width=7 * S), L(d, S, [(84, 56), (84, 80)]), L(d, S, [(28, 82), (92, 82)]), E(d, S, (52, 86, 68, 100), 6)))
icon("clock", lambda d, S: (E(d, S, (24, 24, 96, 96)), L(d, S, [(60, 40), (60, 62), (76, 72)])))

def hero(name, stages, color_last=GRN):
    W, H, N = 760, 170, 24; frames = []
    xs = [40 + i * (680 // (len(stages) - 1)) for i in range(len(stages))]
    for t in range(N):
        im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
        p = t / N; pos = 40 + p * 680
        d.line([(xs[0], 70), (xs[-1], 70)], fill=(225, 222, 213), width=6)
        d.line([(xs[0], 70), (pos, 70)], fill=INK, width=6)
        for i, (x, (lab, sub)) in enumerate(zip(xs, stages)):
            done = pos >= x; last = i == len(stages) - 1
            d.ellipse((x - 26, 44, x + 26, 96), fill=(color_last if last and done else YEL if done else (255, 255, 255)), outline=INK, width=3)
            d.text((x, 70), str(i + 1) if not (last and done) else "✓", fill=INK if not (last and done) else (255, 255, 255), font=F(20), anchor="mm")
            d.text((x, 118), lab, fill=INK, font=F(15), anchor="mm"); d.text((x, 138), sub, fill=MUT, font=F(11, False), anchor="mm")
        d.ellipse((pos - 9, 61, pos + 9, 79), fill=RED if 0.55 < p < 0.62 and name == "erp" else INK)
        frames.append(im)
    frames[0].save(OUT / f"{name}.gif", save_all=True, append_images=frames[1:], duration=110, loop=0, optimize=True)
hero("overview", [("Mailbox", "IMAP · Gmail"), ("AI reads", "PDF · XML · text"), ("Rules decide", "no AI here"), ("ERP", "or a person")])
print("assets:", sorted(p.name for p in OUT.iterdir()))
