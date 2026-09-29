"""
生成 Photo Booth 动画（透明背景 webm / VP9 alpha）
- assets/idle/1,2,3.webm      待机动画，无缝循环
- assets/countdown/1,2.webm   拍照倒计时动画（3、2 | 1 + 闪光收缩）
帧用 Pillow 以 2x 超采样渲染，rawvideo 管道送 ffmpeg 编码。
"""
import math
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg

# ---------- 参数 ----------
W, H = 1280, 720
FPS = 30
SS = 2  # 超采样倍率
CX, CY = W // 2, H // 2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDLE_DIR = os.path.join(ROOT, "assets", "idle")
CD_DIR = os.path.join(ROOT, "assets", "countdown")
os.makedirs(IDLE_DIR, exist_ok=True)
os.makedirs(CD_DIR, exist_ok=True)

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

MAGENTA = (255, 77, 109)
CYAN = (77, 163, 255)
WHITE = (255, 255, 255)
GOLD = (255, 209, 102)


def rgba(c, a):
    return (c[0], c[1], c[2], max(0, min(255, int(a))))


def load_font(size):
    for f in (r"C:\Windows\Fonts\msyhbd.ttc", r"C:\Windows\Fonts\arialbd.ttf"):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def new_frame():
    return Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))


def finish(img):
    return img.resize((W, H), Image.LANCZOS)


def ease_out_back(t):
    c1 = 1.70158
    c3 = c1 + 1
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2


def star_points(cx, cy, r_out, r_in, rot):
    pts = []
    for i in range(10):
        r = r_out if i % 2 == 0 else r_in
        a = rot + i * math.pi / 5 - math.pi / 2
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def dashed_ring(draw, cx, cy, r, rot, color, alpha, width, n_dash, dash_ratio=0.6):
    seg = 360.0 / n_dash
    for i in range(n_dash):
        start = rot + i * seg
        end = start + seg * dash_ratio
        bb = [cx - r, cy - r, cx + r, cy + r]
        draw.arc(bb, start, end, fill=rgba(color, alpha), width=width)


def encode(frames, out_path):
    cmd = [
        FFMPEG, "-y",
        "-f", "rawvideo", "-pix_fmt", "rgba",
        "-s", f"{W}x{H}", "-r", str(FPS),
        "-i", "-",
        "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
        "-auto-alt-ref", "0", "-crf", "30", "-b:v", "0",
        "-row-mt", "1",
        out_path,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for fr in frames:
        proc.stdin.write(fr.tobytes())
    proc.stdin.close()
    proc.wait()
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed for {out_path}")
    print(f"  wrote {out_path} ({os.path.getsize(out_path)//1024} KB)")


# ---------- idle 1：双向旋转虚线环 + 中心呼吸点 ----------
def gen_idle_1(dur=4.0):
    n = int(dur * FPS)
    frames = []
    for i in range(n):
        t = i / n
        img = new_frame()
        d = ImageDraw.Draw(img)
        rot1 = 360 * t
        rot2 = -360 * t
        pulse = 0.5 + 0.5 * math.sin(2 * math.pi * 2 * t)
        dashed_ring(d, CX * SS, CY * SS, 250 * SS, rot1, MAGENTA, 150 + 80 * pulse, 10 * SS, 24)
        dashed_ring(d, CX * SS, CY * SS, 300 * SS, rot2, CYAN, 120 + 60 * pulse, 6 * SS, 36, 0.45)
        dashed_ring(d, CX * SS, CY * SS, 205 * SS, rot1 * 1.5, WHITE, 70 + 50 * pulse, 3 * SS, 48, 0.35)
        r = (14 + 6 * pulse) * SS
        d.ellipse([CX * SS - r, CY * SS - r, CX * SS + r, CY * SS + r], fill=rgba(GOLD, 200))
        frames.append(finish(img))
    return frames


# ---------- idle 2：呼吸圆角取景框 + 上浮气泡 ----------
BUBBLES = [(0.08, 0.9, 26, 1.0), (0.16, 0.55, 16, 0.8), (0.85, 0.8, 30, 1.1),
           (0.92, 0.35, 18, 0.9), (0.75, 0.6, 12, 0.7), (0.28, 0.3, 20, 1.2),
           (0.5, 0.85, 14, 0.85), (0.38, 0.7, 22, 0.95)]


def gen_idle_2(dur=4.0):
    n = int(dur * FPS)
    frames = []
    for i in range(n):
        t = i / n
        img = new_frame()
        d = ImageDraw.Draw(img)
        breathe = 0.5 + 0.5 * math.sin(2 * math.pi * t)
        m = (40 + 10 * breathe) * SS
        alpha = 90 + 100 * breathe
        d.rounded_rectangle([m, m, W * SS - m, H * SS - m], radius=40 * SS,
                            outline=rgba(WHITE, alpha), width=5 * SS)
        cl = 60 * SS
        for (x, y, dx, dy) in [(m, m, 1, 1), (W * SS - m, m, -1, 1),
                               (m, H * SS - m, 1, -1), (W * SS - m, H * SS - m, -1, -1)]:
            d.line([x, y, x + dx * cl, y], fill=rgba(MAGENTA, 220), width=10 * SS)
            d.line([x, y, x, y + dy * cl], fill=rgba(MAGENTA, 220), width=10 * SS)
        for k, (bx, by0, br, speed) in enumerate(BUBBLES):
            by = (by0 - speed * t) % 1.1 - 0.05
            wob = 12 * SS * math.sin(2 * math.pi * (t * 2 + k * 0.37))
            x = bx * W * SS + wob
            y = by * H * SS
            r = br * SS
            a = 60 + 40 * math.sin(2 * math.pi * (t * 3 + k))
            d.ellipse([x - r, y - r, x + r, y + r], outline=rgba(CYAN, a), width=3 * SS)
            d.ellipse([x - r * 0.35, y - r * 0.4, x - r * 0.05, y - r * 0.1], fill=rgba(WHITE, a + 40))
        frames.append(finish(img))
    return frames


# ---------- idle 3：轨道星光 + 闪烁粒子 ----------
SPARKS = [(k * 0.6180339887 % 1.0, (k * 0.3183098861 + 0.13) % 1.0) for k in range(26)]


def gen_idle_3(dur=4.0):
    n = int(dur * FPS)
    frames = []
    for i in range(n):
        t = i / n
        img = new_frame()
        d = ImageDraw.Draw(img)
        for k in range(5):
            a0 = 2 * math.pi * (t + k / 5)
            x = CX * SS + 320 * SS * math.cos(a0)
            y = CY * SS + 200 * SS * math.sin(a0)
            tw = 0.5 + 0.5 * math.sin(2 * math.pi * (t * 4 + k * 0.5))
            r_out = (26 + 14 * tw) * SS
            col = GOLD if k % 2 == 0 else MAGENTA
            d.polygon(star_points(x, y, r_out, r_out * 0.42, a0 * 2), fill=rgba(col, 140 + 100 * tw))
        for k, (sx, sy) in enumerate(SPARKS):
            tw = 0.5 + 0.5 * math.sin(2 * math.pi * (t * 3 + sx * 7 + sy * 3))
            if tw < 0.25:
                continue
            x = sx * W * SS
            y = sy * H * SS
            r = (2 + 4 * tw) * SS
            d.ellipse([x - r, y - r, x + r, y + r], fill=rgba(WHITE, 40 + 160 * tw))
        frames.append(finish(img))
    return frames


# ---------- countdown 公共：大数字 ----------
def draw_digit(d, text, scale, alpha):
    font = load_font(int(300 * SS * scale))
    bb = d.textbbox((0, 0), text, font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    x = CX * SS - tw / 2 - bb[0]
    y = CY * SS - th / 2 - bb[1]
    d.text((x, y), text, font=font, fill=rgba(WHITE, alpha),
           stroke_width=6 * SS, stroke_fill=rgba(MAGENTA, alpha))


def digit_frame(text, local_t, alpha_mult=1.0):
    """local_t: 0..1，pop 出现并保持"""
    img = new_frame()
    d = ImageDraw.Draw(img)
    pop_t = min(local_t / 0.25, 1.0)
    scale = 0.6 + 0.4 * ease_out_back(pop_t)
    fade = 1.0 if local_t < 0.8 else 1.0 - (local_t - 0.8) / 0.2
    a = 255 * fade * alpha_mult
    r = (230 - 30 * local_t) * SS
    d.ellipse([CX * SS - r, CY * SS - r, CX * SS + r, CY * SS + r],
              outline=rgba(CYAN, 180 * fade * alpha_mult), width=6 * SS)
    seg = 360 * local_t
    d.arc([CX * SS - r, CY * SS - r, CX * SS + r, CY * SS + r],
          -90, -90 + seg, fill=rgba(GOLD, 230 * fade * alpha_mult), width=14 * SS)
    draw_digit(d, text, scale, a)
    return finish(img)


def gen_cd_1():
    """1.webm：数字 3 -> 2，共 2 秒"""
    frames = []
    per = FPS  # 每个数字 1 秒
    for i in range(per):
        frames.append(digit_frame("3", i / (per - 1)))
    for i in range(per):
        frames.append(digit_frame("2", i / (per - 1)))
    return frames


def gen_cd_2():
    """2.webm：数字 1（0.9s）-> 白环扩张闪光（0.4s），共 1.3 秒"""
    frames = []
    per1 = int(0.9 * FPS)
    per2 = int(0.4 * FPS)
    for i in range(per1):
        frames.append(digit_frame("1", i / (per1 - 1)))
    for i in range(per2):
        t = i / (per2 - 1)
        img = new_frame()
        d = ImageDraw.Draw(img)
        r = (120 + 700 * t) * SS
        a = 255 * (1 - t)
        d.ellipse([CX * SS - r, CY * SS - r, CX * SS + r, CY * SS + r],
                  outline=rgba(WHITE, a), width=int((18 - 14 * t) * SS))
        r2 = 120 * SS * (1 + 0.6 * t)
        d.ellipse([CX * SS - r2, CY * SS - r2, CX * SS + r2, CY * SS + r2],
                  fill=rgba(WHITE, 90 * (1 - t)))
        frames.append(finish(img))
    return frames


def main():
    print("generating idle animations...")
    encode(gen_idle_1(), os.path.join(IDLE_DIR, "1.webm"))
    encode(gen_idle_2(), os.path.join(IDLE_DIR, "2.webm"))
    encode(gen_idle_3(), os.path.join(IDLE_DIR, "3.webm"))
    print("generating countdown animations...")
    encode(gen_cd_1(), os.path.join(CD_DIR, "1.webm"))
    encode(gen_cd_2(), os.path.join(CD_DIR, "2.webm"))
    print("done.")


if __name__ == "__main__":
    main()
