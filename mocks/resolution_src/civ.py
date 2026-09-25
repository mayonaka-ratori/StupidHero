from rig import *
G = MAT['gray']
MAT['jean3'] = [md(2, 4, 6), md(1, 3, 5), md(1, 2, 4), D]
MAT['hairb'] = [md(5, 3, 1), md(4, 2, 1), RED[3], RED[3]]
MAT['shoe'] = [md(7, 7, 7), G[0], G[1], G[3]]

def hoodie(size):
    f = Fig(size)
    # 奥の脚
    f.cap((3.5, -48), (5, -26), 4.4, 3.5, 'jean3', group='farLeg', shift=-0.15, wr=0.12)
    f.cap((5, -26), (5.5, -6), 3.5, 2.9, 'jean3', group='farLeg', shift=-0.15, wr=0.12)
    f.cap((4, -2.7), (12.5, -2.4), 2.7, 2.3, 'shoe', group='farShoe', shift=-0.1)
    # 手前の脚
    f.cap((-3.5, -48), (-4.8, -26), 4.6, 3.6, 'jean3', group='nearLeg', wr=0.12)
    f.cap((-4.8, -26), (-5.6, -6), 3.6, 3.0, 'jean3', group='nearLeg', wr=0.12)
    f.cap((-7.5, -2.7), (1.5, -2.4), 2.8, 2.4, 'shoe', group='nearShoe')
    # 奥の腕
    f.cap((8, -77), (11, -64), 3.2, 2.8, 'gray', group='farArm', shift=-0.2, wr=0.15)
    f.cap((11, -64), (6, -57), 2.8, 2.6, 'gray', group='farArm', shift=-0.2, wr=0.15)
    # フード(首の後ろ)
    f.ell((-3, -80.5), 6.5, 3.4, 'gray', group='hood', shift=-0.25)
    # 胴
    f.poly([(-10, -78), (-6, -81.5), (7, -81.5), (10, -78), (10.8, -66), (10.2, -49), (-10.2, -49), (-10.8, -66)], 'gray', axis=90, wr=0.12)
    f.poly([(-6.5, -60), (7.5, -60), (8.5, -52.5), (-7.5, -52.5)], 'gray', group='pocket', axis=90, shift=-0.12)
    f.poly([(-10.2, -51.5), (10.2, -51.5), (10.2, -49), (-10.2, -49)], 'gray', group='hem', axis=90, shift=-0.2)
    # 首と頭
    f.cap((1.2, -84), (1.2, -80), 2.4, 2.6, 'skin', group='neck', shift=-0.2)
    f.ell((0.2, -92.2), 7.2, 7.2, 'hairb', group='hair')
    f.ell((3.2, -88.9), 6.0, 7.0, 'skin', group='face', shift=0.35)
    f.poly([(-6.4, -92), (-5.5, -97.5), (0, -100.4), (6.5, -99.4), (9.6, -95.5), (9.4, -93.2), (7.6, -94.6), (5.6, -93), (3.2, -94.6), (1.2, -92.6), (-0.8, -94.2), (-1.8, -89), (-2.8, -86.2), (-6.2, -87)],
           'hairb', group='hair', axis=90, wr=0.2)
    # 手前の腕(手はポケットの中)
    f.cap((-8, -77), (-10.5, -64), 3.3, 2.9, 'gray', group='nearArm', wr=0.15)
    f.cap((-10.5, -64), (-4, -57), 2.9, 2.7, 'gray', group='nearArm', wr=0.15)
    f.render().to_image()
    # 目、まゆ、口、パーカーのひも
    if f.s >= 0.85:
        f.dot((4.4, -89.9), D, 1, 2); f.dot((8.2, -90.0), D, 1, 2)
    else:
        f.dot((4.8, -89.4), D); f.dot((8.4, -89.5), D)
    f.dot((4.3, -91.6), RED[3]); f.dot((5.3, -91.8), RED[3]); f.dot((8.3, -91.8), RED[3])
    f.dot((6.8, -84.5), MAT['skin'][2])
    for y in (-78, -76.5, -75):
        f.dot((-0.5, y), MAT['shoe'][0]); f.dot((3, y), MAT['shoe'][0])
    return f

if __name__ == '__main__':
    from PIL import Image
    ims = [hoodie(n).save(f'cv_{n}.png') for n in (56, 72, 88)]
    sc = 5
    W = sum(i.width * sc for i in ims) + 40; H = max(i.height * sc for i in ims)
    sh = Image.new('RGBA', (W, H), (42, 38, 60, 255)); x = 0
    for i in ims:
        sh.alpha_composite(i.resize((i.width * sc, i.height * sc), Image.NEAREST), (x, H - i.height * sc)); x += i.width * sc + 20
    sh.save('view.png')
    for i in ims:
        print(len(set(tuple(p) for p in i.getdata() if p[3])))
