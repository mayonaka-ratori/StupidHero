# 待機のコマ、2回目。1回目(idle.txt)の頭とマントを使い、胴、腕、スカート、脚を描き直す
from compose import *
def load(path):
    return [list(l.rstrip('\n')[1:-1]) for l in open(path) if l.startswith('|')]
g = G(); g.c = load('idle.txt')
def clear(y0, y1, x0, x1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): g.c[y][x] = '.'
clear(18, 34, 16, 44); clear(24, 25, 15, 15)
clear(35, 48, 24, 52); clear(49, 59, 16, 55)
BODY = {  # x=16 から 29文字
 18: "........oooooocbbboooo.......",
 19: ".odroooo" + "LLLL" + "occbbo" + "BBNN" + "o" + "......",
 20: "odro" + "LLLB" + "LLLBBB" + "oo" + "BBBNN" + "NN" + "o" + ".....",
 21: "dro" + "LLBB" + "o" + "LLLB" + "BBB1BBB" + "NNN" + "o" + "......",
 22: "roLLBNo" + "r" + "o" + "LLBB" + "11H11" + "B" + "NN" + "o" + "BN" + "o" + "....",
 23: "oLLBNo" + "Rrd" + "o" + "LBBB" + "121" + "BB" + "N" + "o" + "." + "oBNo" + "...",
 24: "LBBNo" + "rRrd" + "o" + "LBBB" + "2B2B" + "NN" + "o" + ".." + "oBNo" + "..",
 25: "LBNNo" + "RrrdR" + "o" + "LBBBBBB" + "N" + "o" + "..." + "oBNNo" + ".",
 26: "oLBBNo" + "rdRr" + "o" + "LBBBBBB" + "N" + "o" + ".." + "oBNNo" + "..",
 27: "droLBo123oo" + "LBBBBBBNo" + "o233o" + "....",
 28: "rRro" + "o" + "RRrd" + "o" + "1H1111H12" + "o" + "rrd" + "o" + ".....",
 29: "rRr" + "o" + "RRrrd" + "o" + "RRrrrrRrd" + "o" + "rdd" + "o" + ".....",
 30: "Rrd" + "o" + "rrdd" + "o" + "RrdRrrdrRr" + "o" + "dd" + "o" + "......",
 31: "rrr" + "o" + "ooo" + "RRrdRrrrdrRrrdd" + "do" + ".....",
 32: "dRr" + "rd" + "o" + "RRrrdRrrrdrRrrddd" + "o" + ".....",
 33: "rRrdr" + "o" + "RdrRrdrrdRrdrrRdd" + "o" + ".....",
 34: "rRrdr" + "o" * 19 + ".....",
}
for y, s in BODY.items():
    assert len(s) == 29, (y, len(s), s)
    g.put([(y, 16, s)])
g.put([(24, 15, "o"), (25, 15, "o")])
LEGS = [
 # 手前の脚(明るい)
 (35, 24, "oNNNNNNo"), (36, 24, "oLLBBBNo"), (37, 24, "oLLBBBNo"), (38, 24, "oLBBBNNo"),
 (39, 24, "oLBBBNo"), (40, 24, "oLBBBNo"), (41, 23, "oLLBBNo"), (42, 23, "oLLLBNo"), (43, 23, "oLBBNo"),
 (44, 21, "o1H11223o"), (45, 21, "oRRrrrddo"), (46, 21, "oRRrrrddo"), (47, 21, "oRRrrrdo"),
 (48, 21, "oRRrrddo"), (49, 20, "oRRrrddo"), (50, 20, "oRRrrddo"), (51, 20, "oRwrrddo"),
 (52, 19, "oRRRrrddo"), (53, 19, "oRRRrrddo"), (54, 18, "oRRRRrrrddo"), (55, 17, "oRRRRrrrrrddo"),
 (56, 16, "oRRrrrrrrrrddo"), (57, 16, "oRrrrrrrrrrddo"), (58, 16, "oddddddddddddo"), (59, 17, "ooooooooooooo"),
 # 奥の脚(暗い)
 (35, 32, "NNNNNNo"), (36, 32, "BBNNNNo"), (37, 32, "BBNNNNo"), (38, 32, "oBBNNNo"),
 (39, 32, "oBBNNNo"), (40, 33, "oBNNNo"), (41, 33, "oBBNNo"), (42, 34, "oBBNNo"), (43, 34, "oBNNo"),
 (44, 33, "o1222333o"), (45, 34, "oRrrrddo"), (46, 34, "oRrrrddo"), (47, 35, "oRrrddo"),
 (48, 35, "oRrrddo"), (49, 36, "oRrrddo"), (50, 36, "oRrrddo"), (51, 36, "oRwrddo"),
 (52, 36, "oRRrrddo"), (53, 36, "oRRrrrddo"), (54, 36, "oRRrrrrrddo"), (55, 36, "oRRRrrrrrrddo"),
 (56, 36, "oRrrrrrrrrrddo"), (57, 36, "orrrrrrrrrrddo"), (58, 36, "oddddddddddddo"), (59, 37, "oooooooooooo"),
]
near = LEGS[:25]; far = LEGS[25:]
spread = lambda rows, k: [(y, x + (k * ((y - 38) // 5) if y > 38 else 0), t) for y, x, t in rows]
g.put(spread(near, -1)); g.put(spread(far, 1))
g.save('idle2.txt')
# ---- 頭:ポニーテールを太く、髪のつやを帯で ----
clear(5, 17, 14, 24)
g.put([
 (5, 20, "oooo"),
 (6, 18, "oo1HH1Rr"),
 (7, 17, "o1H1122rd"),
 (8, 16, "o1H1223o"),
 (9, 16, "o11223o"),
 (10, 16, "o1H23o"),
 (11, 16, "o1223o"),
 (12, 17, "o123o"),
 (13, 17, "o123o"),
 (14, 18, "o23o"),
 (15, 18, "o23o"),
 (16, 19, "o3o"),
 (17, 20, "o"),
 (6, 26, "o"),
 (8, 25, "o31HH1HH11212o"),
 (9, 24, "o32H1211121121o"),
])
g.save('idle2.txt')
