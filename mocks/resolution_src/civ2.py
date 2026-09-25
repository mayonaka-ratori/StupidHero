# いまと同じ等身の市民(パーカーの男)
from civ import *
from hero import Scaled, NECK
from hero2 import HK, fig, wide

def hoodie2(size):
    f = fig(size)
    B = Scaled(f, 1.2)
    B.cap((3.5, -48), (5, -26), 4.4, 3.5, 'jean3', group='farLeg', shift=-0.15, wr=0.12)
    B.cap((5, -26), (5.5, -6), 3.5, 2.9, 'jean3', group='farLeg', shift=-0.15, wr=0.12)
    B.cap((4, -2.7), (13.5, -2.4), 2.7, 2.3, 'shoe', group='farShoe', shift=-0.1)
    B.cap((-3.5, -48), (-4.8, -26), 4.6, 3.6, 'jean3', group='nearLeg', wr=0.12)
    B.cap((-4.8, -26), (-5.6, -6), 3.6, 3.0, 'jean3', group='nearLeg', wr=0.12)
    B.cap((-8.5, -2.7), (1.5, -2.4), 2.8, 2.4, 'shoe', group='nearShoe')
    B.cap((9, -75), (12.5, -62), 3.2, 2.8, 'gray', group='farArm', shift=-0.2, wr=0.15)
    B.cap((12.5, -62), (7, -55), 2.8, 2.6, 'gray', group='farArm', shift=-0.2, wr=0.15)
    B.ell((-3, -78.5), 6.5, 3.4, 'gray', group='hood', shift=-0.25)
    f.poly(wide([(-10, -76), (-6, -79.5), (7, -79.5), (10, -76), (10.8, -64), (10.2, -47), (-10.2, -47), (-10.8, -64)], 0), 'gray', axis=90, wr=0.12)
    f.poly(wide([(-6.5, -58), (7.5, -58), (8.5, -50.5), (-7.5, -50.5)], 0), 'gray', group='pocket', axis=90, shift=-0.12)
    f.poly(wide([(-10.2, -49.5), (10.2, -49.5), (10.2, -47), (-10.2, -47)], 0), 'gray', group='hem', axis=90, shift=-0.2)
    # 頭(首の点を中心に大きくする)
    O = lambda p: (NECK[0] + (p[0] - NECK[0]) * HK, NECK[1] + (p[1] - NECK[1]) * HK)
    H = Scaled(f, HK)
    H.cap(O((1.2, -83)), O((1.2, -79.5)), 2.4, 2.6, 'skin', group='neck', shift=-0.2)
    H.ell(O((0.2, -92.2)), 7.2, 7.2, 'hairb', group='hair')
    H.ell(O((3.2, -88.9)), 6.0, 7.0, 'skin', group='face', shift=0.35)
    f.poly([O(p) for p in [(-6.4, -92), (-5.5, -97.5), (0, -100.4), (6.5, -99.4), (9.6, -95.5), (9.4, -93.2), (7.6, -94.6), (5.6, -93), (3.2, -94.6), (1.2, -92.6), (-0.8, -94.2), (-1.8, -89), (-2.8, -86.2), (-6.2, -87)]],
           'hairb', group='hair', axis=90, wr=0.2)
    B.cap((-9, -75), (-11.5, -62), 3.3, 2.9, 'gray', group='nearArm', wr=0.15)
    B.cap((-11.5, -62), (-4, -55), 2.9, 2.7, 'gray', group='nearArm', wr=0.15)
    f.render().to_image()
    e = f.s * HK
    eh = 1 if e < 0.6 else 2 if e < 1.3 else 3
    for ex in (3.4, 7.2):
        x, y = f.P(O((ex, -89.8))); x, y = int(x), int(y) - (eh - 1) // 2
        for j in range(eh): f.px(x, y + j, D)
        f.px(x - 1, y - 1, RED[3]); f.px(x, y - 1, RED[3])
    mx, my = f.P(O((5.8, -85.0)))
    for i in range(1 if e < 0.9 else 2): f.px(int(mx) + i, int(my), MAT['skin'][2])
    for y in (-76, -74.5, -73):
        f.dot((-0.5, y), MAT['shoe'][0]); f.dot((3, y), MAT['shoe'][0])
    return f

if __name__ == '__main__':
    import sys; sys.path.insert(0, '../px')
    ims = [Image.fromarray(hoodie2(n).img, 'RGBA') for n in (54, 90, 108)]
    for i, n in zip(ims, (54, 90, 108)): print(n, len(set(tuple(p) for p in i.getdata() if p[3])))
    sc = [5, 3, 3]
    W = sum(i.width * s for i, s in zip(ims, sc)) + 40; H = max(i.height * s for i, s in zip(ims, sc))
    sh = Image.new('RGBA', (W, H), (42, 38, 60, 255)); x = 0
    for i, s in zip(ims, sc):
        sh.alpha_composite(i.resize((i.width * s, i.height * s), Image.NEAREST), (x, H - i.height * s)); x += i.width * s + 10
    sh.save('view.png')
