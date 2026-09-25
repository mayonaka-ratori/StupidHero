import math
from rig import *

def cape_fold(u, r):
    return 0.42 * np.sin(u * 0.55 + r * 0.05) - 0.004 * np.maximum(r + 60, 0) * 0

def head(f, ox, oy, shout=False):
    O = lambda p: (p[0] + ox, p[1] + oy)
    f.cap(O((1.4, -83)), O((1.4, -79.5)), 2.2, 2.4, 'skin', group='neck', shift=-0.2)
    f.ell(O((0.2, -92.6)), 7.6, 7.4, 'gold', group='hair')
    f.ell(O((3.4, -88.8)), 6.0, 6.7, 'skin', group='face', shift=0.35)
    f.poly([O((-4.5, -94)), O((-3, -98.6)), O((2.5, -100.4)), O((7.8, -98.8)), O((9.8, -94.5)), O((9.6, -91.8)), O((8.2, -93.2)), O((6.8, -91.4)), O((5.4, -93.4)), O((3.8, -91.2)), O((2.4, -93.4)), O((0.6, -91.6)), O((-0.8, -93.6)), O((-1.6, -88)), O((-2.6, -85.5)), O((-4.6, -87))],
           'gold', group='hair', axis=90, wr=0.15)
    f.poly([O((1.0, -90.9)), O((5.6, -91.2)), O((9.5, -91.0)), O((9.4, -88.2)), O((6.4, -88.0)), O((5.6, -88.9)), O((4.8, -88.0)), O((1.0, -88.4))], 'blue', group='mask', shift=-0.3)

def face(f, ox, oy, shout=False):
    O = lambda p: (p[0] + ox, p[1] + oy)
    W, K = MAT['gold'][0], MAT['blue'][3]
    big = f.s >= 0.85
    if big:
        # 目:白目2×2、瞳1×2
        for ex in (3.0, 7.2):
            f.dot(O((ex, -89.9)), W, 2, 2); f.dot(O((ex + 1.2, -89.9)), K, 1, 2)
        if shout:
            f.dot(O((6.6, -85.2)), D, 3, 2); f.dot(O((6.8, -84.0)), MAT['red'][2], 2, 1)
        else:
            f.dot(O((6.4, -84.4)), MAT['skin'][2], 2, 1)
    else:
        f.dot(O((3.3, -89.4)), W); f.dot(O((7.5, -89.5)), W)
        f.dot(O((4.3, -89.4)), K); f.dot(O((8.4, -89.5)), K)
        if shout:
            f.dot(O((7.2, -84.8)), D); f.dot(O((7.2, -83.9)), MAT['red'][2])
        else:
            f.dot(O((7.0, -84.4)), MAT['skin'][2])

def hero_idle(size):
    f = Fig(size)
    # マント(奥)
    f.poly([(-8, -79), (6, -79), (5, -62), (0, -34), (-3, -20), (-9, -15), (-17, -17), (-24, -21), (-27, -27), (-19, -60)],
           'red', axis=100, fold=lambda u, r: 0.45 * np.sin(u * 0.65), shift=-0.12)
    # ポニーテール
    pts = [(-4, -97), (-10, -96.5), (-14.5, -92), (-16, -85), (-15, -79), (-12.5, -75)]
    for i in range(len(pts) - 1):
        f.cap(pts[i], pts[i + 1], 4.2 - i * 0.5, 3.8 - i * 0.5, 'gold', group='tail', wr=0.18)
    # 奥の腕
    f.cap((8, -77), (15.5, -66), 2.7, 2.3, 'blue', group='farArm', shift=-0.18)
    f.cap((15.5, -66), (11.5, -59.5), 2.3, 2.1, 'blue', group='farArm', shift=-0.18)
    f.cap((12.5, -60.5), (9.5, -56.5), 2.5, 2.5, 'red', group='farGlove', shift=-0.15)
    f.ell((8.8, -55.8), 2.9, 2.7, 'red', group='farGlove', shift=-0.15)
    # 奥の脚
    f.cap((4.5, -50), (9, -27), 4.4, 3.2, 'blue', group='farLeg', shift=-0.15)
    f.cap((9.2, -26), (12, -5), 3.5, 2.8, 'red', group='farBoot', shift=-0.1)
    f.cap((10.5, -2.4), (18.5, -2.2), 2.4, 2.2, 'red', group='farBoot', shift=-0.1)
    f.ell((9.2, -25.6), 3.7, 1.3, 'gold', group='farCuff', rot=8, shift=-0.1)
    # 手前の脚
    f.cap((-4, -50), (-8, -27), 4.6, 3.3, 'blue', group='nearLeg')
    f.cap((-8.3, -26), (-11, -5), 3.6, 2.9, 'red', group='nearBoot')
    f.cap((-13.8, -2.4), (-4.8, -2.2), 2.5, 2.3, 'red', group='nearBoot')
    f.ell((-8.2, -25.6), 3.8, 1.3, 'gold', group='nearCuff', rot=-8)
    # スカートとベルト
    f.poly([(-7.2, -61), (7.2, -61), (10, -51), (-10, -51)], 'red', axis=90, fold=lambda u, r: 0.12 * np.sin(u * 1.6))
    f.poly([(-7, -63), (7, -63), (7.3, -60), (-7.3, -60)], 'gold', axis=90)
    # 胴
    f.poly([(-10, -79), (-7, -81.5), (7, -81.5), (10, -79), (9.5, -72), (7.2, -66), (6.2, -62.5), (-6.2, -62.5), (-7.2, -66), (-9.5, -72)], 'blue', axis=90)
    # 首と頭
    head(f, 0, 0)
    # 手前の腕
    f.cap((-9, -77), (-16.5, -65.5), 2.9, 2.4, 'blue', group='nearArm')
    f.cap((-16.5, -65.5), (-12, -59.5), 2.4, 2.2, 'blue', group='nearArm')
    f.cap((-12.8, -60.5), (-9.6, -56.6), 2.6, 2.6, 'red', group='nearGlove')
    f.ell((-8.8, -55.8), 3.0, 2.8, 'red', group='nearGlove')
    
    f.render().to_image()
    # 顔と胸の星(細かさごとに1ドットで置く)
    W, K = MAT['gold'][0], MAT['blue'][3]
    face(f, 0, 0)
    for p in ((1.5, -73.5), (0.5, -72.5), (2.5, -72.5), (1.5, -71.5), (1.5, -72.5)): f.dot(p, MAT['gold'][1])
    f.dot((1.2, -73.6), MAT['gold'][0])
    return f

def hero_punch(size):
    f = Fig(size)
    f.poly([(-2, -77), (6, -79.5), (3, -69), (-6, -63), (-14, -57), (-22, -52), (-28, -54), (-33, -49), (-39, -54), (-37, -59), (-42, -64), (-34, -68), (-24, -72), (-13, -76)],
           'red', axis=170, fold=lambda u, r: 0.45 * np.sin(u * 0.7), shift=-0.12)
    pts = [(7, -92), (0, -93.5), (-6, -91.5), (-12, -92.5), (-17, -90)]
    for i in range(len(pts) - 1):
        f.cap(pts[i], pts[i + 1], 4.0 - i * 0.6, 3.6 - i * 0.6, 'gold', group='tail', wr=0.18)
    # 奥の腕:腰に引く
    f.cap((14, -73), (7.5, -63.5), 2.7, 2.3, 'blue', group='farArm', shift=-0.18)
    f.cap((7.5, -63.5), (11.5, -60), 2.3, 2.2, 'blue', group='farArm', shift=-0.18)
    f.ell((13, -60), 3.0, 2.8, 'red', group='farGlove', shift=-0.15)
    # 前の脚(奥の脚):ひざを曲げて踏みこむ
    f.cap((7, -46), (21, -30), 4.4, 3.3, 'blue', group='farLeg', shift=-0.15)
    f.cap((20.5, -29), (17.5, -5), 3.5, 2.8, 'red', group='farBoot', shift=-0.1)
    f.cap((16, -2.4), (25.5, -2.2), 2.4, 2.2, 'red', group='farBoot', shift=-0.1)
    f.ell((20.6, -28.8), 3.7, 1.3, 'gold', group='farCuff', rot=-6, shift=-0.1)
    # 後ろの脚(手前の脚):まっすぐ伸ばす
    f.cap((-3, -46), (-13, -27), 4.6, 3.3, 'blue', group='nearLeg')
    f.cap((-13.5, -26), (-22.5, -8), 3.6, 2.9, 'red', group='nearBoot')
    f.cap((-23.5, -6.5), (-18.5, -2.2), 2.6, 2.3, 'red', group='nearBoot')
    f.ell((-13.3, -26.4), 3.8, 1.3, 'gold', group='nearCuff', rot=-28)
    # スカート、ベルト、胴(前へ傾ける)
    f.poly([(-4.8, -56.5), (9.2, -58.5), (13, -48.5), (-6.5, -46)], 'red', axis=95, fold=lambda u, r: 0.12 * np.sin(u * 1.6))
    f.poly([(-4.6, -59), (8.8, -61), (9.2, -58), (-4.8, -56)], 'gold', axis=95)
    f.poly([(0, -75), (4, -78.5), (16, -76.5), (17.5, -72.5), (14.5, -66.5), (11, -61.5), (9.5, -59.5), (-4, -57.5), (-3.8, -62), (-2.5, -68.5)], 'blue', axis=105)
    head(f, 10, 6.5)
    # 手前の腕:まっすぐ前へ
    f.cap((3, -72.5), (16, -71.5), 2.9, 2.5, 'blue', group='nearArm')
    f.cap((16, -71.5), (26, -71.5), 2.5, 2.3, 'blue', group='nearArm')
    f.cap((25.5, -71.5), (29.5, -71.5), 2.7, 2.7, 'red', group='nearGlove')
    f.ell((33, -71.7), 3.6, 3.2, 'red', group='nearGlove')
    f.render().to_image()
    face(f, 10, 6.5, shout=True)
    for p in ((11, -69), (10, -68), (12, -68), (11, -67), (11, -68)): f.dot(p, MAT['gold'][1])
    return f

if __name__ == '__main__':
    ims = [hero_idle(n).save(f'hi_{n}.png') for n in (56, 72, 88)] + [hero_punch(n).save(f'hp_{n}.png') for n in (56, 72, 88)]

    from PIL import Image
    sc = 4
    W = sum(i.width * sc for i in ims) + 40; H = max(i.height * sc for i in ims)
    sh = Image.new('RGBA', (W, H), (42, 38, 60, 255)); x = 0
    for i in ims:
        sh.alpha_composite(i.resize((i.width * sc, i.height * sc), Image.NEAREST), (x, H - i.height * sc)); x += i.width * sc + 20
    sh.save('view.png')
