# 路地裏の背景。W は画面の横のドット数(216/360/432)。れんがの大きさは画面の中で同じに見えるようにする
import math, random
import numpy as np
from PIL import Image
from rig import md

BR = [md(5, 2, 1), md(4, 1, 1), md(3, 1, 1), md(2, 1, 1), md(1, 0, 1)]
MORT = md(1, 0, 1)
WIN = [md(7, 7, 4), md(7, 6, 2), md(7, 4, 1), md(5, 3, 1)]
FR = [md(4, 4, 5), md(3, 3, 4), md(2, 2, 3), md(1, 1, 2)]
WALK = [md(4, 4, 5), md(3, 3, 4), md(2, 2, 3), md(1, 1, 2)]
ROAD = [md(2, 2, 3), md(1, 1, 2), md(1, 1, 1), md(0, 0, 1)]
PIPE = [md(5, 5, 6), md(3, 3, 4), md(2, 2, 3)]

def alley(W, seed=3):
    k = W / 216.0
    H = int(round(214 * k))
    rnd = random.Random(seed)
    img = np.zeros((H, W, 3), dtype=np.uint8)
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H: img[y, x] = c
    wallB = int(round(H * 0.70)); walkB = int(round(H * 0.78))
    bw = max(8, int(round(12 * k))); bh = max(4, bw // 2)
    # れんが
    for row in range(0, wallB // bh + 1):
        off = (bw // 2) if row % 2 else 0
        for col in range(-1, W // bw + 2):
            x0 = col * bw - off; y0 = row * bh
            tone = rnd.choice([1, 1, 1, 2, 2, 0, 3])
            for y in range(y0, min(y0 + bh, wallB)):
                for x in range(x0, x0 + bw):
                    if x < 0 or x >= W: continue
                    lx, ly = x - x0, y - y0
                    if lx == bw - 1 or ly == bh - 1:
                        c = MORT
                    else:
                        t = tone
                        if ly == 0 or lx == 0: t = max(0, t - 1)          # 上と左の角に光
                        if ly == bh - 2 or lx == bw - 2: t = min(4, t + 1)  # 下と右に影
                        # 細かいざらつき(細かいほど粒が増える)
                        if rnd.random() < 0.10: t = min(4, t + 1)
                        elif rnd.random() < 0.05: t = max(0, t - 1)
                        c = BR[t]
                    put(x, y, c)
            # 欠け
            if k > 1.2 and rnd.random() < 0.25:
                cx = x0 + rnd.randrange(1, bw - 2); cy = y0 + rnd.randrange(0, bh - 1)
                put(cx, cy, BR[4]); put(cx + 1, cy, BR[3])
    # 上を暗く(夜。市松で2色をまぜる)
    for y in range(0, int(H * 0.18)):
        for x in range(W):
            if (x + y) % 2 == 0 and y < H * 0.18 * (0.5 + 0.5 * ((x * 7) % 5) / 5): img[y, x] = BR[4] if tuple(img[y, x]) != MORT else MORT
    # 窓(明かりがついている)
    def window(x0, y0, w, h):
        for y in range(y0 - 2, y0 + h + 3):
            for x in range(x0 - 2, x0 + w + 2):
                edge = x < x0 or x >= x0 + w or y < y0 or y >= y0 + h
                if edge:
                    c = FR[0] if (y == y0 - 2 or x == x0 - 2) else FR[2] if (y >= y0 + h + 1 or x == x0 + w + 1) else FR[1]
                    if y >= y0 + h + 1: c = FR[0] if y == y0 + h + 1 else FR[3]
                    put(x, y, c)
                else:
                    ly = (y - y0) / h; lx = (x - x0) / w
                    t = 0 if ly < 0.25 else 1 if ly < 0.6 else 2
                    if (x + y) % 2 and ly > 0.5: t = min(3, t + 1)
                    if abs(lx - 0.5) * w < 0.6 * k or abs(ly - 0.5) * h < 0.6 * k: c = FR[1]
                    else: c = WIN[t]
                    # カーテン
                    if lx < 0.22: c = WIN[3] if (y + x) % 3 else WIN[2]
                    put(x, y, c)
    ww, wh = int(20 * k), int(26 * k)
    window(int(W * 0.14), int(H * 0.16), ww, wh)
    window(int(W * 0.62), int(H * 0.16), ww, wh)
    # 雨どい
    px = int(W * 0.88); pw = max(3, int(round(4 * k)))
    for y in range(0, wallB):
        for i in range(pw):
            put(px + i, y, PIPE[0] if i == 0 else PIPE[2] if i == pw - 1 else PIPE[1])
        if y % int(30 * k) == 0:
            for i in range(-1, pw + 1): put(px + i, y, FR[0]); put(px + i, y + 1, FR[2])
    # 歩道
    for y in range(wallB, walkB):
        for x in range(W):
            ly = y - wallB
            t = 0 if ly == 0 else 3 if y == walkB - 1 else 1 if ly < 2 * k else 2 if (x + y) % 2 == 0 and ly > (walkB - wallB) * 0.6 else 1
            if x % int(28 * k) == 0 and 0 < ly < walkB - wallB - 1: t = 3
            if rnd.random() < 0.06 and t in (1, 2): t += 1
            put(x, y, WALK[t])
    # 道路(ざらざら)
    for y in range(walkB, H):
        for x in range(W):
            r = rnd.random()
            t = 1 if r < 0.55 else 0 if r < 0.72 else 2
            if y == walkB: t = 3
            put(x, y, ROAD[t])
    # マンホール
    mx, my, mr = int(W * 0.72), int(H * 0.90), 11 * k
    for y in range(H):
        for x in range(W):
            d = ((x + .5 - mx) / mr) ** 2 + ((y + .5 - my) / (mr * 0.35)) ** 2
            if d <= 1:
                put(x, y, ROAD[3] if d > 0.75 else FR[2] if (x + y) % 3 == 0 else FR[3])
    return Image.fromarray(img, 'RGB')

if __name__ == '__main__':
    ims = [alley(w) for w in (216, 360, 432)]
    for i, w in zip(ims, (216, 360, 432)): i.save(f'bg_{w}.png')
    sc = [4, 2, 2]
    tot = sum(i.width * s for i, s in zip(ims, sc)) + 40
    sh = Image.new('RGB', (tot, max(i.height * s for i, s in zip(ims, sc))), (0, 0, 0)); x = 0
    for i, s in zip(ims, sc): sh.paste(i.resize((i.width * s, i.height * s), Image.NEAREST), (x, 0)); x += i.width * s + 20
    sh.save('view.png')
