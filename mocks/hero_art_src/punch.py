import math, importlib.util
from compose import *
spec = importlib.util.spec_from_file_location('idle', 'idle.py'); I = importlib.util.module_from_spec(spec); spec.loader.exec_module(I)

g = G()
DX, DY = 5, 4
lean = lambda y: (35 - y) // 3 if y < 35 else 0
def shift(rows, dx, dy, shear=False):
    return [(y + dy, x + dx + (lean(y) if shear else 0), s) for y, x, s in rows]

# マント:肩の一点から扇のように広がるひだ
AX, AY = 32, 25
for y in range(18, 48):
    for x in range(3, 33):
        dx, dy = AX - x, y - AY
        if dx < 0: continue
        topE = -2 + 0.06 * dx + math.sin(dx * 0.55) * 0.6
        botE = 2 + 0.55 * dx
        if not (topE <= dy <= botE): continue
        end = 26 + (2 if (y // 3) % 2 else 0) - max(0, dy - 8) * 0.25
        if dx > end: continue
        th = math.atan2(dy + 0.5, dx + 0.5)
        band = math.sin(th * 14 + 0.6)
        ch = 'R' if band > 0.55 else 'd' if band < -0.45 else 'r'
        if dy >= botE - 1.2: ch = 'd'
        g.px(x, y, ch)
cells = [(x, y) for y in range(64) for x in range(64) if g.get(x, y) != '.']
for x, y in cells:
    for ax, ay in ((1,0),(-1,0),(0,1),(0,-1)):
        if g.get(x+ax, y+ay) == '.': g.px(x+ax, y+ay, 'o')

# 後ろの脚(手前の脚):左下へまっすぐ伸ばす
g.limb((34, 39), (27, 47), 6, 5, ('L', 'B', 'N'))
g.limb((27, 48), (22, 54), 5, 5, ('R', 'r', 'd'))
g.put([(47, 24, "o1123o"), (48, 24, "o1223o")])
g.put([(52, 17, "..oRRrdo"), (53, 16, "..oRRrrdo"), (54, 16, ".oRRrrrddo"), (55, 16, "oRRrrrrrddo"),
       (56, 16, "oRrrrrrrddo"), (57, 16, "oddddddddo"), (58, 17, "ooooooooo")])
g.px(22, 50, 'w')
# 前の脚(奥の脚):ひざを曲げて前へ踏みこむ
g.limb((41, 39), (46, 46), 6, 5, ('B', 'N', 'N'))
g.limb((47, 47), (47, 54), 5, 5, ('R', 'r', 'd'))
g.put([(46, 44, "o22333o")])
g.put([(55, 44, "oRrrrddoo"), (56, 44, "oRRrrrrdddo"), (57, 44, "oRrrrrrrrddo"), (58, 44, "oddddddddddo"), (59, 45, "oooooooooo")])
g.px(46, 50, 'w')

# 胴(待機の胴を前へ傾ける)
body = [r for r in I.body if r[0] <= 33]
g.put(shift(body, DX, DY, True))
g.put(shift([(34, 22, "ooooddooooddoooo")], DX, DY, True))
# 奥の腕:腰に引いたこぶし
g.put([(30, 42, ".oooo"), (31, 41, "o3rrdo"), (32, 41, "orrrddo"), (33, 41, "orrddo"), (34, 42, "oooo")])
# 頭とポニーテール
HX, HY = 11, 5
tail = [
 (5, 21, "oooooo"),
 (6, 17, "oooo1HH12Rr"),
 (7, 14, "ooo1122111122d"),
 (8, 13, "o1223332222233"),
 (9, 13, "oo3oo..o33333o"),
 (10, 14, "o..ooo..ooooo"),
]
g.put(shift(tail, HX, HY))
g.put(shift(I.head, HX, HY))
# 口を開けて叫ぶ
g.put([(15 + HY, 34 + HX, "odo"), (16 + HY, 34 + HX, "oo")])
# 手前の腕:まっすぐ前へ突き出す
g.limb((35, 27), (49, 26), 3, 3, ('L', 'B', 'N'))
g.put([(25, 32, '.ooo'), (26, 31, 'oLLLo'), (27, 31, 'oLBBo'), (28, 31, 'oBNNo'), (29, 32, 'ooo')])
g.put([(24, 48, "oo"), (25, 47, "o23"), (26, 47, "o23"), (27, 47, "o33"), (28, 48, "oo")])
g.put([
 (22, 50, "..ooooo"),
 (23, 50, ".oRRRRRo"),
 (24, 50, "oRRRRRRdo"),
 (25, 50, "oRRrRrRdo"),
 (26, 50, "oRrrrrrdo"),
 (27, 50, "orrrrrddo"),
 (28, 50, ".odddddo"),
 (29, 50, "..ooooo"),
])
g.save('punch.txt')
