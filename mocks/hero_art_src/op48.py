# 48×48の顔(オペレーター)
import math
from compose import *
from face48 import shade3

def op48(ek='open', mouth='small', brow=0, sweat=False, blush=False, fist=False):
    g = G(48, 48)
    HR = ['K', 'k', 'q']
    # 制服
    poly(g, [(3, 48), (4.5, 42), (11, 38.5), (19, 37.5), (29, 37.5), (37, 38.5), (43, 42), (45, 48)],
         lambda x, y: 'T' if (x < 13 and y < 45) or (y == 39 and x < 18) else 'D' if x > 37 else 't')
    # えり(白)とリボン
    poly(g, [(18, 37), (24, 45), (30, 37), (28, 36), (24, 41), (20, 36)], 'w')
    poly(g, [(11, 39.5), (18.5, 37.5), (22, 48), (15, 48)], lambda x, y: 'T' if x < 15 else 't')
    poly(g, [(37, 39.5), (29.5, 37.5), (26, 48), (33, 48)], 'D')
    # 首
    poly(g, [(19.5, 29), (28.5, 29), (28, 38), (24, 40), (20.5, 38)], lambda x, y: 'c' if y < 33 else 'b' if x > 25 else 'a')
    g.put([(40, 20, "RR.RR"), (41, 21, "RpR"), (42, 20, "RR.RR")])
    # 後ろ髪(ボブ)
    poly(g, [(7, 20), (8.5, 11), (13, 5), (20, 2), (29, 2), (36, 5), (40.5, 11), (42, 20), (42, 30), (40.5, 35), (37, 36), (34, 32), (15, 32), (11.5, 36), (8, 35), (6.5, 29)],
         lambda x, y: HR[shade3(x, y, 21, 14, 18, 18, (-0.45, 0.35))])
    # 顔
    poly(g, [(13, 13), (36, 13), (37, 21), (35.5, 27.5), (32, 32), (27, 34.5), (23, 34), (18.5, 30.5), (14.5, 24)],
         lambda x, y: 'b' if x >= 35 or y >= 32 or (y >= 29 and x <= 19) else 'a')
    # 横の髪(顔の両側を包む)
    poly(g, [(8, 14), (15, 12), (16, 20), (15.5, 29), (13.5, 35), (10, 36), (8, 31)], lambda x, y: 'K' if x < 11 and y < 22 else 'k' if y < 30 else 'q')
    poly(g, [(35, 12), (41, 14), (41.5, 24), (40, 33), (37, 35), (36.5, 25)], lambda x, y: 'k' if y < 21 else 'q')
    # 前髪(まっすぐ切りそろえて、少しすき間)
    for x in range(10, 40):
        bot = 15 + (1 if x in (15, 16, 24, 25, 32) else 0) + (1 if x > 36 else 0)
        for y in range(3, bot):
            if g.get(x, y) == '.': continue
            c = 'K' if (y < 8 and x < 22) or x + y < 20 else 'k'
            if y >= bot - 2: c = 'q' if x in (14, 17, 23, 26, 31) or y == bot - 1 else 'k'
            g.px(x, y, c)
        for x2 in (14, 21, 29):
            for y2 in range(10, 15): g.px(x2 + (1 if y2 < 12 else 0), y2, 'q')
    # 髪のつや(頭の上の弧)
    for x in range(11, 32):
        y = round(8.5 - 3.5 * math.sin((x - 11) / 21 * math.pi))
        if g.get(x, y) in ('k', 'K'): g.px(x, y, 's')
        if g.get(x, y + 1) == 'k': g.px(x, y + 1, 'K')
    # まゆ
    if brow < 0: g.put([(16, 16, "..qq"), (17, 15, "qq"), (16, 29, "qq.."), (17, 31, "qq")])
    elif brow > 0: g.put([(16, 15, ".qqq"), (16, 29, "qqq")])
    else: g.put([(16, 15, "qqqq"), (16, 29, "qqq")])
    # 目
    EY = {
     'open':  [".ooooo.", "owwTTDo", "owTwtDo", "owTtDDo", "owtDDDo", ".owwwo."],
     'wide':  [".ooooo.", "owwwwwo", "owwTwwo", "owwtwwo", "owwwwwo", ".ooooo."],
     'flat':  [".......", ".......", "ooooooo", "owTtDDo", "owtDDDo", ".owwwo."],
     'happy': [".......", ".......", "..ooo..", ".o...o.", "o.....o", "......."],
    }
    EYF = {
     'open':  [".oooo.", "owTTDo", "oTwtDo", "oTtDDo", "otDDDo", ".owwo."],
     'wide':  [".oooo.", "owwwwo", "owTwwo", "owtwwo", "owwwwo", ".oooo."],
     'flat':  ["......", "......", "oooooo", "oTtDDo", "otDDDo", ".owwo."],
     'happy': ["......", "......", ".ooo..", "o...o.", "......", "......"],
    }
    for (x0, rows) in ((15, EY[ek]), (28, EYF[ek])):
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch != '.': g.px(x0 + i, 18 + j, ch)
    # 鼻
    g.px(33, 26, 'b'); g.px(33, 27, 'c')
    if blush:
        for x, y in ((16, 27), (17, 27), (18, 27), (31, 27), (32, 27)): g.px(x, y, 'p')
    M = {
     'small':    [(30, 25, "ooo")],
     'talk':     [(29, 25, "ooo"), (30, 24, "oRRRo"), (31, 25, "ooo")],
     'wavy':     [(30, 23, ".o...o"), (31, 23, "o.o.o."), (32, 23, "...o..")],
     'yell':     [(28, 23, ".oooo."), (29, 23, "owwwwo"), (30, 23, "oRRRRo"), (31, 23, "oRppRo"), (32, 23, ".oooo.")],
     'flat':     [(30, 24, "oooo")],
     'flatOpen': [(29, 24, "oooo"), (30, 24, "oRRo"), (31, 25, "oo")],
     'smile':    [(29, 23, "o...o"), (30, 24, "ooo")],
     'bigSmile': [(29, 22, "ooooooo"), (30, 22, "owwwwwo"), (31, 22, "oRRpRRo"), (32, 23, "ooooo")],
    }
    for y, x, s in M[mouth]:
        for i, ch in enumerate(s):
            if ch != '.': g.px(x + i, y, ch)
    # ヘッドセット:頭のバンド、耳あて、マイク
    for x in range(6, 42):
        t = (x - 6) / 35
        y = round(19 - math.sin(t * math.pi) * 17.5)
        g.px(x, y, 'S'); g.px(x, y - 1, 's' if t < .55 else 'S')
    g.put([(18, 3, ".oooo."), (19, 2, "ossssSo"), (20, 2, "osssSSo"), (21, 2, "ossRSSo"), (22, 2, "osssSSo"), (23, 2, "ossSSSo"), (24, 2, "osSSSSo"), (25, 3, ".oooo.")])
    for i, (x, y) in enumerate([(8, 26), (9, 27), (10, 28), (11, 29), (12, 30), (13, 30), (14, 31), (15, 31), (16, 31)]):
        g.px(x, y, 's')
    g.put([(30, 16, "oo"), (31, 16, "ssSo"), (32, 16, "oo")])
    if sweat:
        g.put([(10, 41, ".o."), (11, 40, "oTTo"), (12, 40, "oTwo"), (13, 40, "oTTo"), (14, 41, "oo")])
    outline(g)
    if fist:
        f = G(48, 48)
        poly(f, [(34, 48), (44, 48), (43, 38), (37, 37.5)], lambda x, y: 'T' if x < 38 else 't' if x < 41 else 'D')
        poly(f, [(36.5, 38.5), (43.5, 38.5), (43.3, 36.5), (36.8, 36.3)], 'w')
        f.put([(26, 36, ".oooooo."), (27, 35, "oaaaaaab"), (28, 35, "occcccbb"), (29, 35, "oaaaaaab"), (30, 35, "occcccbb"), (31, 35, "oaaaaaab"),
               (32, 35, "occcccbb"), (33, 35, "oaaaaabo"), (34, 36, "obbbbbo"), (35, 36, "abbbbbb")])
        outline(f)
        for y in range(48):
            for x in range(48):
                if f.c[y][x] != '.': g.c[y][x] = f.c[y][x]
    return g

FACES = [('open', 'small', 'talk', {}), ('wide', 'wavy', 'yell', {'brow': -1, 'sweat': True}),
         ('flat', 'flat', 'flatOpen', {'brow': -1}), ('happy', 'smile', 'bigSmile', {'brow': 1, 'blush': True, 'fist': True})]
if __name__ == '__main__':
    for i, (e, m0, m1, kw) in enumerate(FACES):
        op48(e, m0, **kw).save(f'f48o{i}a.txt', 'pal_op.txt'); op48(e, m1, **kw).save(f'f48o{i}b.txt', 'pal_op.txt')
