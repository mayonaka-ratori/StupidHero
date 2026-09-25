# 48×48の顔(ヒーロー)。形を図形で置いてから、目、口、毛先を手で打つ
import math
from compose import *

def shade3(x, y, cx, cy, rx, ry, k=(-0.4, 0.5)):
    t = ((x + .5 - cx) / rx) * 0.7 + ((y + .5 - cy) / ry) * 0.7
    return 0 if t < k[0] else 2 if t > k[1] else 1

def hero48(ek='normal', mouth='smirk', sweat=False, blush=False):
    g = G(48, 48)
    HR = ['H', '1', '2', '3']
    # ポニーテール(奥、左)
    poly(g, [(12, 6), (7, 7), (3, 12), (1.5, 19), (2, 27), (4, 33), (7, 35), (9, 33), (7.5, 27), (8, 20), (10, 13)],
         lambda x, y: 'H' if (x == 3 and 13 <= y <= 17) or (x == 4 and 10 <= y <= 12) else '1' if x < 5 and y < 24 else '2' if x < 7 or y < 26 else '3')
    # マントの肩と胴
    poly(g, [(0, 48), (0, 41), (4, 38), (13, 36.5), (13, 48)], lambda x, y: 'R' if x + y < 43 else 'r' if x < 9 else 'd')
    poly(g, [(48, 48), (48, 41), (44, 38), (35, 36.5), (35, 48)], lambda x, y: 'r' if y < 41 and x < 44 else 'd')
    poly(g, [(6, 48), (7.5, 42), (13, 38.5), (20, 37.5), (29, 37.5), (36, 38.5), (41, 42), (43, 48)],
         lambda x, y: 'L' if (x < 14 and y < 44) or (y == 39 and x < 20) else 'N' if x > 36 else 'B')
    # 首
    poly(g, [(19.5, 29), (29.5, 29), (29, 39), (25, 41), (20.5, 39)], lambda x, y: 'c' if y < 34 else 'b' if x > 25 else 'a')
    # 後ろ髪
    ell(g, 25, 18, 17, 16.5, lambda x, y: None if y > 30 else HR[min(3, shade3(x, y, 22, 14, 16, 16, (-0.35, 0.45)) + (1 if y > 24 else 0))])
    # 顔
    poly(g, [(14, 13), (38.5, 13), (39.5, 22), (38.5, 28), (35.5, 32.5), (30.5, 35.5), (27, 35.5), (22, 32.5), (18.5, 28), (15.5, 22)],
         lambda x, y: 'b' if x >= 37 or y >= 33 or (y >= 30 and x <= 21) else 'a')
    # 耳
    ell(g, 16, 25, 2.2, 3.2, lambda x, y: 'b' if x > 15 else 'a'); g.px(16, 25, 'c'); g.px(16, 26, 'c')
    # 横の髪(左と右)
    poly(g, [(9, 11), (16.5, 11), (16, 19), (14.5, 28), (12, 33), (9, 31), (8, 23)],
         lambda x, y: '1' if x < 13 and y < 24 else '2' if y < 30 else '3')
    poly(g, [(36.5, 11), (42, 12), (43, 20), (41.5, 27), (39.5, 30), (39, 20)], lambda x, y: '2' if y < 19 else '3')
    # マスク(目のまわり)
    poly(g, [(9, 18), (15, 16.5), (24, 18.5), (27, 18.5), (35, 16.5), (43, 17.5), (41, 25), (34, 26.5), (29, 25.5), (26.5, 23.5), (24, 25.5), (19, 26.5), (12, 25)],
         lambda x, y: 'B' if y <= 18 and x < 22 else 'N')
    for x, y in ((12, 18), (13, 18), (14, 18), (11, 19)): g.px(x, y, 'L')
    # 目
    EY = {
     'normal': ["ooooooo", "owwwLBo", "owwLBNo", "owwBNNo", ".owwwo."],
     'smug':   [".......", "ooooooo", "owwLBNo", "owwBNNo", ".owwwo."],
     'happy':  [".......", "..ooo..", ".o...o.", "o.....o", "......."],
     'squeeze':["oo.....", "..ooo..", "....oo.", "..ooo..", "oo....."],
    }
    EYF = {
     'normal': ["oooooo", "owwLBo", "owLBNo", "owBNNo", ".owwo."],
     'smug':   ["......", "oooooo", "owLBNo", "owBNNo", ".owwo."],
     'happy':  ["......", ".ooo..", "o...o.", "......", "......"],
     'squeeze':[".....o", "..ooo.", ".oo...", "..ooo.", ".....o"],
    }
    def eye(x0, y0, rows):
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch == '.':
                    if eye_kind in ('happy', 'squeeze'): g.px(x0 + i, y0 + j, 'a')
                    continue
                g.px(x0 + i, y0 + j, ch)
    eye_kind = ek
    eye(16, 19, EY[ek]); eye(30, 19, EYF[ek])
    # 前髪:毛の束をとがらせてマスクにかぶせる
    tips = [(9, 17), (13, 21), (16, 15.5), (19.5, 20), (23, 15), (26.5, 19.5), (30, 14.5), (33.5, 18.5), (37, 14), (40, 17.5), (42, 13)]
    def bottom(px):
        for (x0, y0), (x1, y1) in zip(tips, tips[1:]):
            if x0 <= px < x1: return y0 + (y1 - y0) * (px - x0) / (x1 - x0)
        return 12
    for x in range(10, 42):
        bb = bottom(x + .5)
        rise = bottom(x + 1.5) < bb
        for y in range(3, 24):
            if y + .5 >= bb: break
            if g.get(x, y) == '.': continue
            c = 'H' if (y < 7 and x < 26) or (x + y < 25) else '1'
            if y + 2 >= bb: c = '3' if rise else '2'
            elif y + 3.5 >= bb and rise: c = '2'
            g.px(x, y, c)
    # 毛の束の分かれ目
    for x0, y0 in ((16, 15), (23, 14.5), (30, 14), (37, 13.5)):
        for k in range(6):
            g.px(round(x0 - k * 0.35), round(y0 - 1 - k), '2')
    # 髪のつや(左上の弧)
    for x in range(12, 34):
        y = round(10.5 - 3.2 * math.sin((x - 12) / 22 * math.pi))
        if g.get(x, y) in ('1', '2'): g.px(x, y, 'H')
        if g.get(x, y + 1) == '1' and x % 4 == 1: g.px(x, y + 1, 'H')
    # 髪ゴム
    g.put([(8, 10, "Rr"), (9, 10, "rd")])
    # 鼻
    g.px(36, 27, 'b'); g.px(36, 28, 'c')
    if blush:
        for x, y in ((17, 28), (18, 28), (19, 28), (33, 28), (34, 28)): g.px(x, y, 'R')
    M = {
     'smirk':     [(29, 30, "...oo"), (30, 26, "oooo.")],
     'smirkOpen': [(29, 28, "..ooo"), (30, 26, "oooRo"), (31, 26, "odRdo"), (32, 27, "ooo")],
     'wavy':      [(29, 26, ".o...o"), (30, 26, "o.o.o."), (31, 26, "...o..")],
     'wail':      [(28, 26, ".oooo."), (29, 26, "oddddo"), (30, 26, "odddRo"), (31, 26, "oRRRRo"), (32, 26, ".oooo.")],
     'smile':     [(29, 25, "o.....o"), (30, 26, "ooooo")],
     'bigSmile':  [(29, 25, "ooooooo"), (30, 25, "owwwwwo"), (31, 25, "oddRRdo"), (32, 26, "ooooo")],
    }
    for y, x, s in M[mouth]:
        for i, ch in enumerate(s):
            if ch != '.': g.px(x + i, y, ch)
    if sweat:
        g.put([(13, 42, ".o."), (14, 41, "oLLo"), (15, 41, "oLwo"), (16, 41, "oLLo"), (17, 42, "oo")])
    # 胸の星
    g.put([(41, 22, "...1..."), (42, 22, ".11H11."), (43, 22, "..121.."), (44, 22, ".12.21."), (45, 22, ".2...2.")])
    # マントの留め金
    for cx, c in ((12, '2'), (37, '3')):
        g.put([(39, cx - 1, "o" + c + "o"), (40, cx - 1, c + "1" + c), (41, cx - 1, "o" + c + "o")])
    outline(g)
    return g

FACES = [('smug', 'smirk', 'smirkOpen', {}), ('squeeze', 'wavy', 'wail', {'sweat': True}), ('happy', 'smile', 'bigSmile', {'blush': True})]
if __name__ == '__main__':
    for i, (e, m0, m1, kw) in enumerate(FACES):
        hero48(e, m0, **kw).save(f'f48h{i}a.txt'); hero48(e, m1, **kw).save(f'f48h{i}b.txt')
    hero48('normal', 'smirk').save('f48h_n.txt')
