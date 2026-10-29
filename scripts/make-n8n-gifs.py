#!/usr/bin/env python3
"""One small animated GIF per workflow, each showing what that workflow does. Output: n8n-assets/*.gif"""
import math, pathlib
from PIL import Image, ImageDraw, ImageFont
OUT = pathlib.Path(__file__).resolve().parent.parent / "n8n-assets"; OUT.mkdir(exist_ok=True)
W, H, N = 640, 200, 24
INK, YEL, BG, MUT, GRN, RED, LINE, WHITE = (28, 28, 30), (247, 212, 76), (246, 244, 238), (139, 139, 144), (47, 138, 76), (196, 61, 47), (225, 222, 213), (255, 255, 255)
F = lambda s, b=True: ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf" if b else "/System/Library/Fonts/Supplemental/Arial.ttf", s)
ease = lambda t: t * t * (3 - 2 * t)
def save(name, frames, dur=90): frames[0].save(OUT / name, save_all=True, append_images=frames[1:], duration=dur, loop=0, optimize=True)
def envelope(d, x, y, w=54, h=38, fill=WHITE):
    d.rounded_rectangle((x, y, x + w, y + h), 5, fill=fill, outline=INK, width=3); d.line([(x + 3, y + 4), (x + w / 2, y + h / 2 + 2), (x + w - 3, y + 4)], fill=INK, width=3)
def cylinder(d, x, y, w=90, h=96, fill=0):
    d.rectangle((x, y + 10, x + w, y + h - 10), fill=WHITE); d.ellipse((x, y + h - 20, x + w, y + h), fill=WHITE, outline=INK, width=3)
    if fill: d.rectangle((x + 3, y + h - 10 - fill, x + w - 3, y + h - 10), fill=YEL); d.ellipse((x + 3, y + h - 20, x + w - 3, y + h - 2), fill=YEL)
    d.line([(x, y + 10), (x, y + h - 10)], fill=INK, width=3); d.line([(x + w, y + 10), (x + w, y + h - 10)], fill=INK, width=3); d.ellipse((x, y, x + w, y + 20), fill=WHITE, outline=INK, width=3)
cap = lambda d, x, y, t, s=14, c=INK, b=True: d.text((x, y), t, fill=c, font=F(s, b), anchor="mm")

# 1 · Intake: emails fly into the database, get a "Processed" tag, then go on
fr = []
for t in range(N):
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im); p = t / (N - 1)
    cap(d, 70, 30, "Mailbox", 14); cap(d, 320, 30, "Postgres first", 14); cap(d, 560, 30, "Process Email", 14)
    d.rounded_rectangle((30, 50, 110, 150), 12, outline=INK, width=3, fill=WHITE)
    for i in range(3):
        k = (p * 3 - i); k = max(0.0, min(1.0, k)); x = 46 + ease(k) * 230; y = 82 - math.sin(k * math.pi) * 40
        if k < 1: envelope(d, x, y)
    cylinder(d, 275, 52, 90, 100, fill=int(min(1, p * 1.3) * 70))
    if p > 0.75: d.rounded_rectangle((375, 70, 470, 98), 14, fill=GRN); cap(d, 422, 84, "Processed", 12, WHITE)
    d.line([(480, 110), (520, 110)], fill=INK if p > 0.8 else LINE, width=4); d.polygon([(520, 102), (534, 110), (520, 118)], fill=INK if p > 0.8 else LINE)
    d.rounded_rectangle((540, 80, 610, 140), 12, outline=INK, width=3, fill=YEL if p > 0.85 else WHITE); cap(d, 575, 110, "1 run", 13)
    cap(d, 320, 182, "stored before anything can fail · nothing is lost", 12, MUT, False); fr.append(im)
save("intake.gif", fr)

# 2 · Process Email: a scanner reads the invoice, fields fill in, rules tick them
fr = []
fields = [("Supplier", "Schäfer GmbH"), ("Number", "RE-2026-1015"), ("Net · VAT", "1.750,00 · 332,50"), ("Gross", "2.082,50 EUR")]
for t in range(N):
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im); p = t / (N - 1)
    d.rounded_rectangle((40, 20, 200, 185), 8, fill=WHITE, outline=INK, width=3); cap(d, 120, 38, "RECHNUNG", 12)
    for i in range(7): d.line([(58, 60 + i * 16), (182 - (i % 3) * 22, 60 + i * 16)], fill=LINE, width=6)
    sy = 50 + (p * 1.4 % 1) * 125 if p < 0.72 else 175; d.line([(44, sy), (196, sy)], fill=YEL, width=5)
    cap(d, 260, 100, "AI reads", 12, MUT, False); d.polygon([(240, 112), (280, 112), (280, 106), (292, 116), (280, 126), (280, 120), (240, 120)], fill=INK)
    for i, (k, v) in enumerate(fields):
        y = 30 + i * 40; shown = p > 0.15 + i * 0.14; ok = p > 0.78
        d.rounded_rectangle((310, y, 600, y + 32), 10, fill=WHITE if shown else BG, outline=(GRN if ok else INK) if shown else LINE, width=2)
        d.text((322, y + 16), k, fill=MUT, font=F(11, False), anchor="lm")
        if shown: d.text((420, y + 16), v, fill=INK, font=F(13), anchor="lm")
        if ok: d.ellipse((574, y + 6, 594, y + 26), fill=GRN); d.line([(579, y + 16), (583, y + 21), (590, y + 11)], fill=WHITE, width=3)
    if p > 0.8: cap(d, 455, 190, "rules decide: every value appears in the PDF", 11, GRN)
    fr.append(im)
save("process.gif", fr)

# 3 · ERP Booking: ERP in maintenance → clock retries → green → booked once
fr = []
for t in range(N):
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im); p = t / (N - 1); up = p > 0.55
    d.rounded_rectangle((440, 40, 560, 160), 14, fill=WHITE, outline=INK, width=3)
    for i in range(3): d.line([(462, 70 + i * 24), (520, 70 + i * 24)], fill=LINE, width=6)
    d.ellipse((530, 60, 548, 78), fill=GRN if up else RED); cap(d, 500, 178, "ERP online" if up else "ERP maintenance (503)", 12, GRN if up else RED)
    k = min(1, p / 0.3) if not up else min(1, 0.3 / 0.3 + (p - 0.55) / 0.3 * 0.0); x = 60 + ease(min(1, p / 0.3)) * 230
    if up: x = 290 + ease(min(1, (p - 0.55) / 0.3)) * 150
    if not (up and p > 0.86):
        d.rounded_rectangle((x, 84, x + 90, 120), 8, fill=YEL, outline=INK, width=2); cap(d, x + 45, 102, "invoice", 12)
    if 0.3 < p <= 0.55:
        a = (p - 0.3) / 0.25 * 720; cx, cy = 360, 102; d.ellipse((cx - 26, cy - 52, cx + 26, cy), outline=INK, width=3)
        d.line([(cx, cy - 26), (cx + 18 * math.cos(math.radians(a - 90)), cy - 26 + 18 * math.sin(math.radians(a - 90)))], fill=INK, width=3); cap(d, cx, 150, "retry every 5 min", 12, MUT, False)
    if up and p > 0.86: d.ellipse((470, 80, 530, 140), fill=GRN); d.line([(485, 110), (497, 122), (516, 96)], fill=WHITE, width=6); cap(d, 330, 102, "booked exactly once", 14, GRN)
    cap(d, 120, 30, "Send to ERP", 14); fr.append(im)
save("erp.gif", fr)

# 4 · Review: a red field is corrected, Approve, BOOKED stamp
fr = []
for t in range(N):
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im); p = t / (N - 1)
    d.rounded_rectangle((60, 16, 420, 184), 16, fill=WHITE)
    rows = [("Net", "1.000,00", None), ("VAT 19 %", "190,00", None), ("Gross", "1.000,00" if p < 0.4 else "1.190,00", RED if p < 0.4 else GRN)]
    for i, (k, v, c) in enumerate(rows):
        y = 30 + i * 38; d.text((80, y + 14), k, fill=MUT, font=F(12, False), anchor="lm")
        d.rounded_rectangle((180, y, 400, y + 28), 8, fill=(251, 233, 230) if c == RED else (231, 243, 234) if c == GRN else BG, outline=c or BG, width=2); d.text((192, y + 14), v, fill=INK, font=F(13), anchor="lm")
    if p < 0.4: d.text((180, 142), "net + VAT ≠ gross", fill=RED, font=F(11), anchor="lm")
    pressed = 0.55 < p < 0.65; d.rounded_rectangle((180, 140, 330, 172), 16, fill=(230, 196, 60) if pressed else YEL); cap(d, 255, 156, "Approve", 13)
    if 0.48 < p < 0.66: d.polygon([(300, 160), (300, 182), (306, 176), (312, 188), (316, 186), (311, 174), (319, 174)], fill=INK)
    if p > 0.68:
        s = Image.new("RGBA", (190, 70), (0, 0, 0, 0)); sd = ImageDraw.Draw(s); sd.rounded_rectangle((4, 4, 186, 66), 10, outline=GRN, width=5); sd.text((95, 35), "BOOKED", fill=GRN, font=F(30), anchor="mm")
        s = s.rotate(-8, expand=True, resample=Image.BICUBIC); im.paste(s, (440, 60), s)
    cap(d, 530, 175, "who · when · before / after → audit log", 11, MUT, False); fr.append(im)
save("review.gif", fr)

# 5 · Monitoring: heartbeat, a red spike, the bell rings, one e-mail to Avanai
fr = []
for t in range(N):
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im); p = t / (N - 1)
    pts = []
    for x in range(20, 420, 4):
        k = (x / 400 + p) % 1; y = 100
        if 0.30 < k < 0.34: y = 100 - 30 * math.sin((k - 0.30) / 0.04 * math.pi)
        if 0.70 < k < 0.76: y = 100 - 70 * math.sin((k - 0.70) / 0.06 * math.pi)
        pts.append((x, y))
    d.line(pts, fill=INK, width=3)
    alarm = 0.45 < p
    bx, by = 480 + (6 * math.sin(t * 2) if 0.45 < p < 0.75 else 0), 70
    d.pieslice((bx - 30, by - 30, bx + 30, by + 30), 180, 360, fill=RED if alarm else WHITE, outline=INK, width=3); d.rectangle((bx - 30, by, bx + 30, by + 22), fill=RED if alarm else WHITE, outline=INK, width=3); d.ellipse((bx - 8, by + 22, bx + 8, by + 36), fill=INK)
    if p > 0.7: envelope(d, 470 + ease(min(1, (p - 0.7) / 0.25)) * 100, 130, 50, 34, YEL)
    cap(d, 220, 30, "every 15 min + every failure", 13); cap(d, 520, 186, "one e-mail per problem", 11, MUT, False); fr.append(im)
save("monitoring.gif", fr)
print("gifs:", [p.name for p in sorted(OUT.glob("*.gif"))])
