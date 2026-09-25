from PIL import Image
from bg import alley
from hero2 import idle2 as hero_idle, punch2 as hero_punch
from civ2 import hoodie2 as hoodie
import numpy as np

def shadow(img, cx, y, rx):
    px = img.load()
    for yy in range(y - 1, y + 2):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            d = ((x - cx) / rx) ** 2 + ((yy - y) / 1.6) ** 2
            if d <= 1 and (x + yy) % 2 == 0 and 0 <= x < img.width and 0 <= yy < img.height:
                px[x, yy] = (0, 0, 36)

def scene(W, size):
    bg = alley(W).convert('RGBA')
    H = bg.height
    feet = int(round(H * 0.88))
    for f, cx, flip in ((hero_idle(size), W * 0.30, False), (hoodie(size), W * 0.70, True)):
        im = Image.fromarray(f.img, 'RGBA')
        if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
        shadow(bg, cx, feet, size * 0.16)
        bg.alpha_composite(im, (int(round(cx - im.width / 2)), feet - f.base))
    return bg

# 今のゲームの画面(スマホの幅で撮ったものを、216×214のドットにもどす)
def current():
    im = Image.open('../street.png').convert('RGB')
    s = im.width / 216
    out = Image.new('RGB', (216, 214))
    for y in range(214):
        for x in range(216):
            out.putpixel((x, y), im.getpixel((int((x + 0.5) * s), int((y + 0.5) * s))))
    return out

if __name__ == '__main__':
    current().save('sc_now.png')
    for W, size, name in ((216, 54, 'A'), (360, 90, 'B'), (432, 108, 'C')):
        scene(W, size).save(f'sc_{name}.png')
    for n in (54, 90, 108):
        hero_idle(n).save(f'hi_{n}.png'); hero_punch(n).save(f'hp_{n}.png'); hoodie(n).save(f'cv_{n}.png')
    ims = [Image.open(f'sc_{n}.png') for n in ('now', 'A', 'B', 'C')]
    sc = [390 / i.width for i in ims]
    rs = [i.resize((390, round(i.height * 390 / i.width)), Image.NEAREST) for i in ims]
    sh = Image.new('RGB', (390 * 4 + 30, max(r.height for r in rs)))
    for k, r in enumerate(rs): sh.paste(r, (k * 400, 0))
    sh.save('view.png')
