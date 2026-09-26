# いまと同じ等身(頭が身長の約23%、4.5頭身くらい)で描く版
from hero import *

HK = 1.45   # 頭の大きさ(6頭身の版に対して)
TOP = 108   # 頭のてっぺんの高さ(単位)。身長のドット数をこれで割って1単位の大きさにする

def wide(pts, cx, k=1.15):
    return [(cx + (x - cx) * k, y) for x, y in pts]

def fig(size):
    f = Fig(size)
    f.s = size / TOP
    return f

def idle2(size):
    f = fig(size)
    B = Scaled(f, 1.2)
    f.poly([(-9, -77), (7, -77), (6, -60), (1, -34), (-3, -20), (-9, -15), (-17, -17), (-25, -21), (-28, -27), (-20, -60)],
           'red', axis=100, fold=lambda u, r: 0.45 * np.sin(u * 0.6), shift=-0.12)
    # ポニーテール(頭の後ろから)
    pts = [(-5, -106), (-13, -105), (-18.5, -99), (-20, -91), (-18.5, -84), (-15.5, -80)]
    for i in range(len(pts) - 1):
        f.cap(pts[i], pts[i + 1], 5.0 - i * 0.6, 4.6 - i * 0.6, 'gold', group='tail', wr=0.18)
    # 奥の腕
    B.cap((9, -75), (17.5, -63.5), 3.4, 2.9, 'blue', group='farArm', shift=-0.18)
    B.cap((17.5, -63.5), (12.5, -56.5), 2.9, 2.7, 'blue', group='farArm', shift=-0.18)
    B.cap((13.5, -57.5), (10.5, -54), 3.1, 3.1, 'red', group='farGlove', shift=-0.15)
    B.ell((9.6, -53.4), 3.6, 3.4, 'red', group='farGlove', shift=-0.15)
    # 奥の脚
    B.cap((5, -48), (9, -26), 5.2, 4.0, 'blue', group='farLeg', shift=-0.15)
    B.cap((9.2, -25), (11.5, -5), 4.2, 3.4, 'red', group='farBoot', shift=-0.1)
    B.cap((10, -2.9), (19.5, -2.7), 2.9, 2.7, 'red', group='farBoot', shift=-0.1)
    B.ell((9.2, -24.8), 4.4, 1.5, 'gold', group='farCuff', rot=6, shift=-0.1)
    # 手前の脚
    B.cap((-4.5, -48), (-8, -26), 5.4, 4.1, 'blue', group='nearLeg')
    B.cap((-8.2, -25), (-10.5, -5), 4.3, 3.5, 'red', group='nearBoot')
    B.cap((-13.8, -2.9), (-4, -2.7), 3.0, 2.8, 'red', group='nearBoot')
    B.ell((-8.1, -24.8), 4.5, 1.5, 'gold', group='nearCuff', rot=-6)
    # スカート、ベルト、胴
    f.poly(wide([(-8.2, -59), (8.2, -59), (11, -48.5), (-11, -48.5)], 0), 'red', axis=90, fold=lambda u, r: 0.12 * np.sin(u * 1.4))
    f.poly(wide([(-8, -61.5), (8, -61.5), (8.3, -58.5), (-8.3, -58.5)], 0), 'gold', axis=90)
    f.poly(wide([(-11, -76), (-8, -79), (8, -79), (11, -76), (10.5, -70), (8.2, -65), (7.2, -61), (-7.2, -61), (-8.2, -65), (-10.5, -70)], 0), 'blue', axis=90)
    head(f, 0, 0, k=HK)
    # 手前の腕
    B.cap((-9.5, -75), (-18, -63.5), 3.5, 3.0, 'blue', group='nearArm')
    B.cap((-18, -63.5), (-13, -56.5), 3.0, 2.8, 'blue', group='nearArm')
    B.cap((-13.8, -57.5), (-10.6, -54), 3.2, 3.2, 'red', group='nearGlove')
    B.ell((-9.6, -53.4), 3.7, 3.5, 'red', group='nearGlove')
    f.render().to_image()
    face(f, 0, 0, k=HK)
    for p in ((1.5, -71.5), (0.4, -70.4), (2.6, -70.4), (1.5, -69.3), (1.5, -70.4)): f.dot(p, MAT['gold'][1])
    f.dot((1.2, -71.6), MAT['gold'][0])
    return f

def punch2(size):
    f = fig(size)
    B = Scaled(f, 1.2)
    f.poly([(-2, -75), (6, -77.5), (3, -67), (-6, -61), (-14, -55), (-22, -50), (-28, -52), (-33, -47), (-39, -52), (-37, -57), (-42, -62), (-34, -66), (-24, -70), (-13, -74)],
           'red', axis=170, fold=lambda u, r: 0.45 * np.sin(u * 0.7), shift=-0.12)
    pts = [(6, -103), (-2, -104.5), (-9, -102), (-16, -103), (-22, -100)]
    for i in range(len(pts) - 1):
        f.cap(pts[i], pts[i + 1], 5.0 - i * 0.7, 4.5 - i * 0.7, 'gold', group='tail', wr=0.18)
    B.cap((14, -71), (7.5, -61.5), 3.4, 2.9, 'blue', group='farArm', shift=-0.18)
    B.cap((7.5, -61.5), (11.5, -58), 2.9, 2.7, 'blue', group='farArm', shift=-0.18)
    B.ell((13, -58), 3.6, 3.4, 'red', group='farGlove', shift=-0.15)
    B.cap((7, -44), (20, -29), 5.2, 4.0, 'blue', group='farLeg', shift=-0.15)
    B.cap((19.5, -28), (17, -5), 4.2, 3.4, 'red', group='farBoot', shift=-0.1)
    B.cap((15.5, -2.9), (25, -2.7), 2.9, 2.7, 'red', group='farBoot', shift=-0.1)
    B.ell((19.6, -27.8), 4.4, 1.5, 'gold', group='farCuff', rot=-6, shift=-0.1)
    B.cap((-3, -44), (-12.5, -26), 5.4, 4.1, 'blue', group='nearLeg')
    B.cap((-13, -25), (-21.5, -8), 4.3, 3.5, 'red', group='nearBoot')
    B.cap((-22.5, -6.5), (-17.5, -2.7), 3.1, 2.8, 'red', group='nearBoot')
    B.ell((-12.8, -25.4), 4.5, 1.5, 'gold', group='nearCuff', rot=-28)
    f.poly(wide([(-5.5, -54.5), (9.5, -56.5), (13, -46.5), (-7, -44)], 3), 'red', axis=95, fold=lambda u, r: 0.12 * np.sin(u * 1.4))
    f.poly(wide([(-5.3, -57), (9.2, -59), (9.6, -56), (-5.5, -54)], 2), 'gold', axis=95)
    f.poly(wide([(-1, -73), (3, -77), (16, -75), (18, -71), (15, -64.5), (11, -59.5), (9.8, -57.5), (-4.8, -55.5), (-4.5, -60), (-3, -66.5)], 6), 'blue', axis=105)
    head(f, 9.5, 3.5, shout=True, k=HK)
    B.cap((3, -70.5), (16, -69.5), 3.5, 3.0, 'blue', group='nearArm')
    B.cap((16, -69.5), (26, -69.5), 3.0, 2.8, 'blue', group='nearArm')
    B.cap((25.5, -69.5), (29.5, -69.5), 3.2, 3.2, 'red', group='nearGlove')
    B.ell((33.5, -69.7), 4.3, 3.8, 'red', group='nearGlove')
    f.render().to_image()
    face(f, 9.5, 3.5, shout=True, k=HK)
    for p in ((11, -67), (10, -66), (12, -66), (11, -65), (11, -66)): f.dot(p, MAT['gold'][1])
    return f

if __name__ == '__main__':
    from PIL import Image
    ims = [idle2(n) for n in (54, 90, 108)] + [punch2(n) for n in (54, 90, 108)]
    ims = [Image.fromarray(f.img, 'RGBA') for f in ims]
    ims.insert(0, Image.open('hi_56.png'))
    sc = [4, 4, 3, 2, 4, 3, 2]
    W = sum(i.width * s for i, s in zip(ims, sc)) + 80; H = max(i.height * s for i, s in zip(ims, sc))
    sh = Image.new('RGBA', (W, H), (42, 38, 60, 255)); x = 0
    for i, s in zip(ims, sc):
        sh.alpha_composite(i.resize((i.width * s, i.height * s), Image.NEAREST), (x, H - i.height * s)); x += i.width * s + 10
    sh.save('view.png')
