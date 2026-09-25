# パンチのコマ、2回目。1回目(punch.txt)のマントと脚を使い、上半身を描き直す
from compose import *
def load(path):
    return [list(l.rstrip('\n')[1:-1]) for l in open(path) if l.startswith('|')]
g = G(); g.c = load('punch.txt')
idle = load('idle2.txt')
def clear(y0, y1, x0, x1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): g.c[y][x] = '.'
clear(9, 21, 18, 63); clear(22, 28, 32, 63); clear(29, 38, 31, 63)
g.c[50][22] = 'o'; g.c[51][24] = 'w'
# ポニーテール(後ろへなびく)
g.put([
 (9, 32, "oooooo"),
 (10, 28, "oooo1HH111Rr"),
 (11, 25, "ooo11HH11122rd"),
 (12, 23, "o11222111122o"),
 (13, 22, "o1233322222o"),
 (14, 22, "oo3oo..oo33o"),
 (15, 23, "o"),
])
# 頭(待機の頭を右下へずらす。ポニーテールの部分は使わない)
DX, DY = 12, 4
for y in range(5, 18):
    for x in range(24, 41):
        ch = idle[y][x]
        if ch != '.': g.px(x + DX, y + DY, ch)
g.put([(19, 46, "odo"), (20, 46, "oo")])
# 胴(腕の下に見えるところ)、ベルト、スカート(後ろへなびく)
g.put([
 (22, 40, "ocbbbo"),
 (28, 34, "ooooooo" + "BB1NN" + "o"),
 (29, 35, "oL" + "BBBB" + "11H11" + "N" + "o"),
 (30, 35, "oL" + "BBBBB" + "121" + "B" + "N" + "o"),
 (31, 35, "oL" + "BBBBB" + "2B2" + "N" + "o"),
 (32, 34, "o1H111H1223o"),
 (33, 33, "oRRrrdRrrdRrdo"),
 (34, 31, "oRRrrdRrrrdRrddo"),
 (35, 30, "oRRrrdRrrrdrRrddo"),
 (36, 29, "oRRrrrdRrrrdrRrddo"),
 (37, 28, "oRdrrdRrdrrdRrdrddo"),
 (38, 28, "ooooooooooooooooooo"),
])
# 奥の腕:腰に引いたこぶし
g.put([(31, 47, "ooo"), (32, 46, "o3rdo"), (33, 46, "orddo"), (34, 47, "ooo")])
# 手前の腕:肩からまっすぐ前へ
g.put([
 (21, 35, "ooooo"),
 (22, 33, ".oLLLLLL" + "oooooooooooo"[:11]),
 (23, 33, "oLLBBBBBN" + "LLLLLLLLLL"),
 (24, 33, "oLBBBBBBN" + "BBBBBBBBBB"),
 (25, 33, "oBBBBBBNN" + "BBBBBBBBNN"),
 (26, 33, "oBBBBBNNN" + "NNNNNNNNNN"),
 (27, 33, ".oNNNNNN" + "ooooooooooo"),
])
# 金の袖口とグローブ
g.put([(21, 52, "oo"), (22, 52, "12"), (23, 52, "12"), (24, 52, "22"), (25, 52, "23"), (26, 52, "33"), (27, 52, "oo")])
g.put([
 (20, 55, "oooooo"),
 (21, 54, "oRRRRRRo"),
 (22, 54, "RRRrRRrdo"),
 (23, 54, "RRRRRRRdo"),
 (24, 54, "RrRrRrRdo"),
 (25, 54, "rrrrrrrdo"),
 (26, 54, "rrrrrrddo"),
 (27, 54, "oddddddo"),
 (28, 55, "oooooo"),
])
g.save('punch2.txt')
