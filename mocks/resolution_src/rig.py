# 身長100の単位で決めた体を、好きな細かさのドット絵にする。
# ふちは黒ではなく、その部品の一番暗い色(光の当たらない側はもっと暗い共通の色)。色は4段。
import math
import numpy as np
from PIL import Image

LV = [0, 36, 73, 109, 146, 182, 219, 255]
def md(r, g, b): return (LV[r], LV[g], LV[b])
D = md(1, 0, 2)
RED = [md(7, 4, 3), md(7, 1, 1), md(5, 0, 1), md(3, 0, 1)]
MAT = {
    'blue': [md(3, 5, 7), md(1, 3, 6), md(1, 2, 5), md(0, 1, 3)],
    'red': RED,
    'skin': [md(7, 6, 5), md(7, 5, 3), md(5, 3, 3), RED[3]],
    'gold': [md(7, 7, 4), md(7, 5, 1), md(5, 3, 0), RED[3]],
    'gray': [md(6, 6, 6), md(4, 4, 5), md(3, 3, 4), md(2, 2, 3)],
    'jean': [md(2, 4, 6), md(1, 3, 5), md(1, 2, 4), md(0, 1, 2)],
    'brown': [md(5, 3, 1), md(4, 2, 1), md(3, 1, 1), md(2, 1, 0)],
    'white': [md(7, 7, 7), md(6, 6, 6), md(4, 4, 5), md(2, 2, 3)],
}
L = np.array([-0.55, -0.65, 0.52]); L = L / np.linalg.norm(L)

class Fig:
    def __init__(self, size, w=None, h=None):
        """size = 身長のドット数。w, h はコマの大きさ(ドット)"""
        self.s = size / 100.0
        self.w = w or int(round(size * 1.15)); self.h = h or int(round(size * 1.15))
        self.cx = self.w / 2; self.base = self.h - max(2, round(size * 0.07))
        self.parts = []
    def P(self, p):  # 設計の点 → ドットの座標
        return (self.cx + p[0] * self.s, self.base + p[1] * self.s)
    # ---- 部品を足す(後から足したものが手前) ----
    def cap(self, a, b, r0, r1, mat, group=None, wr=0.0, shift=0.0):
        self.parts.append(('cap', (a, b, r0, r1), mat, group or len(self.parts), wr, shift))
    def ell(self, c, rx, ry, mat, group=None, shift=0.0, rot=0.0):
        self.parts.append(('ell', (c, rx, ry, rot), mat, group or len(self.parts), 0, shift))
    def poly(self, pts, mat, group=None, axis=90.0, wr=0.0, shift=0.0, fold=None):
        self.parts.append(('poly', (pts, axis, fold), mat, group or len(self.parts), wr, shift))

    def render(self):
        W, H, s = self.w, self.h, self.s
        ys, xs = np.mgrid[0:H, 0:W]
        px = xs + 0.5; py = ys + 0.5
        pid = np.full((H, W), -1); inten = np.zeros((H, W))
        for i, (kind, g, mat, group, wr, shift) in enumerate(self.parts):
            if kind == 'cap':
                a, b, r0, r1 = g
                ax, ay = self.P(a); bx, by = self.P(b)
                dx, dy = bx - ax, by - ay; l2 = dx * dx + dy * dy or 1e-6
                t = np.clip(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1)
                qx, qy = ax + dx * t, ay + dy * t
                r = (r0 + (r1 - r0) * t) * s
                ox, oy = px - qx, py - qy
                d = np.hypot(ox, oy)
                m = d <= r
                u = np.clip(d / np.maximum(r, 1e-6), 0, 1)
                nx, ny = ox / np.maximum(d, 1e-6) * u, oy / np.maximum(d, 1e-6) * u
                nz = np.sqrt(np.clip(1 - u * u, 0, 1))
                v = nx * L[0] + ny * L[1] + nz * L[2]
                if wr:
                    v = v + wr * np.sin(t * math.hypot(dx, dy) / s * 0.9 + (ox - oy) * 0.35 / s)
            elif kind == 'ell':
                c, rx, ry, rot = g
                cx, cy = self.P(c); rx *= s; ry *= s
                ca, sa = math.cos(math.radians(rot)), math.sin(math.radians(rot))
                lx = ((px - cx) * ca + (py - cy) * sa) / rx; ly = (-(px - cx) * sa + (py - cy) * ca) / ry
                q = lx * lx + ly * ly
                m = q <= 1
                nz = np.sqrt(np.clip(1 - q, 0, 1))
                v = lx * L[0] + ly * L[1] + nz * L[2]
            else:
                pts, axis, fold = g
                P = [self.P(p) for p in pts]
                m = inpoly(P, px, py)
                # 軸に直角な向きで、丸い筒として陰を付ける
                ang = math.radians(axis)
                ux, uy = math.cos(ang), math.sin(ang)  # 軸の向き
                vx, vy = -uy, ux                         # 横の向き
                proj = (px - self.cx) * vx + (py - self.base) * vy
                v = np.zeros_like(px)
                rows = (px - self.cx) * ux + (py - self.base) * uy
                if m.any():
                    # 同じ「行」(軸にそった位置)ごとの幅から、横の位置 -1〜1 を出す
                    rq = np.round(rows[m] / 1.0).astype(int); pq = proj[m]
                    lo = {}; hi = {}
                    for rr, pp in zip(rq, pq):
                        lo[rr] = min(lo.get(rr, 1e9), pp); hi[rr] = max(hi.get(rr, -1e9), pp)
                    lo_a = np.array([lo[r] for r in rq]); hi_a = np.array([hi[r] for r in rq])
                    u = (pq - (lo_a + hi_a) / 2) / np.maximum((hi_a - lo_a) / 2 + 0.5, 0.5)
                    u = np.clip(u, -1, 1)
                    nx, ny = u * vx, u * vy
                    nz = np.sqrt(np.clip(1 - u * u, 0, 1))
                    vv = nx * L[0] + ny * L[1] + nz * L[2]
                    if fold:
                        vv = vv + fold(pq / s, rows[m] / s)
                    if wr:
                        vv = vv + wr * np.sin(rows[m] / s * 0.9 + pq / s * 0.4)
                    v[m] = vv
            v = v + shift
            pid[m] = i; inten[m] = v[m]
        self.pid, self.inten = pid, inten
        return self

    def to_image(self, thr=(0.62, 0.38, 0.12)):
        H, W = self.pid.shape
        out = np.zeros((H, W, 4), dtype=np.uint8)
        tone = np.full((H, W), 3)
        tone[self.inten > thr[2]] = 2; tone[self.inten > thr[1]] = 1; tone[self.inten > thr[0]] = 0
        groups = [p[3] for p in self.parts]
        mats = [p[2] for p in self.parts]
        # ふち:外側。光の来ない側(右と下)は共通の暗い色、光の側は部品の一番暗い色
        edge = np.zeros((H, W), dtype=int)  # 0なし 1部品の暗い色 2共通の暗い色
        for y in range(H):
            for x in range(W):
                i = self.pid[y, x]
                if i < 0: continue
                for dx, dy, far in ((1, 0, 2), (0, 1, 2), (-1, 0, 1), (0, -1, 1)):
                    X, Y = x + dx, y + dy
                    j = self.pid[Y, X] if 0 <= X < W and 0 <= Y < H else -1
                    if j < 0:
                        edge[y, x] = max(edge[y, x], far)
                    elif groups[j] != groups[i] and j < i:
                        # 奥の部品の、手前の部品に接するところを暗くする(重なりの影)
                        if edge[Y, X] == 0: edge[Y, X] = 3
        for y in range(H):
            for x in range(W):
                i = self.pid[y, x]
                if i < 0: continue
                ramp = MAT[mats[i]]
                e = edge[y, x]
                if e == 2: c = D
                elif e == 1: c = ramp[3]
                elif e == 3: c = ramp[min(3, tone[y, x] + 2)]
                else: c = ramp[tone[y, x]]
                out[y, x] = (*c, 255)
        self.img = out
        return self

    def dot(self, p, col, w=1, h=1):
        x, y = self.P(p); x, y = int(math.floor(x)), int(math.floor(y))
        for j in range(h):
            for i in range(w):
                if 0 <= y + j < self.h and 0 <= x + i < self.w: self.img[y + j, x + i] = (*col, 255)
    def px(self, x, y, col):
        if 0 <= y < self.h and 0 <= x < self.w: self.img[y, x] = (*col, 255)
    def save(self, path, scale=1):
        im = Image.fromarray(self.img, 'RGBA')
        if scale != 1: im = im.resize((self.w * scale, self.h * scale), Image.NEAREST)
        im.save(path); return im

def inpoly(P, px, py):
    ins = np.zeros(px.shape, dtype=bool)
    j = len(P) - 1
    for i in range(len(P)):
        xi, yi = P[i]; xj, yj = P[j]
        c = ((yi > py) != (yj > py)) & (px < (xj - xi) * (py - yi) / ((yj - yi) if yj != yi else 1e-9) + xi)
        ins ^= c; j = i
    return ins
