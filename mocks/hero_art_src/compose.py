# 部品(y, x, 文字列)を重ねて64×64の表を作る。'.'は透明(下の絵を残す)、'_'は消す
import sys
def compose(layers, w=64, h=64):
    g=[['.']*w for _ in range(h)]
    for layer in layers:
        for y,x,s in layer:
            for i,ch in enumerate(s):
                if ch=='.': continue
                if 0<=x+i<w and 0<=y<h: g[y][x+i]= '.' if ch=='_' else ch
    return g
def block(y0,x0,rows):
    return [(y0+j,x0,r) for j,r in enumerate(rows)]
def save(g,path,pal='pal_hero.txt'):
    with open(path,'w') as f:
        f.write(open(pal).read())
        for r in g: f.write('|'+''.join(r)+'|\n')

class G:
    """64×64の表に、部品をじかに描く"""
    def __init__(s, w=64, h=64): s.w, s.h = w, h; s.c = [['.']*w for _ in range(h)]
    def px(s, x, y, ch):
        if 0 <= x < s.w and 0 <= y < s.h: s.c[y][x] = ch
    def get(s, x, y): return s.c[y][x] if 0 <= x < s.w and 0 <= y < s.h else '.'
    def put(s, segs, dx=0, dy=0):
        for y, x, t in segs:
            for i, ch in enumerate(t):
                if ch == '.': continue
                s.px(x+i+dx, y+dy, '.' if ch == '_' else ch)
    def limb(s, a, b, w0, w1, ramp, cap=True):
        """a→b の棒。縦長なら行ごと、横長なら列ごとに、明るい1ドット、ふつう、影1〜2ドットで塗る。ふち付き"""
        (x0, y0), (x1, y1) = a, b
        hi, mid, lo = ramp
        if abs(y1-y0) >= abs(x1-x0):
            ys = range(min(y0,y1), max(y0,y1)+1)
            for y in ys:
                t = 0 if y1 == y0 else (y-y0)/(y1-y0)
                cx = x0+(x1-x0)*t; w = w0+(w1-w0)*t
                l = round(cx-w/2); r = l+max(1,round(w))-1
                for x in range(l, r+1):
                    k = x-l; n = r-l+1
                    s.px(x, y, hi if k == 0 else lo if k >= n-(2 if n >= 5 else 1) else mid)
                s.px(l-1, y, 'o'); s.px(r+1, y, 'o')
            if cap:
                for y, xx in ((min(y0,y1)-1, x0 if y0 < y1 else x1), (max(y0,y1)+1, x1 if y0 < y1 else x0)):
                    w = w0 if xx == x0 else w1
                    l = round(xx-w/2)
                    for x in range(l, l+round(w)): s.px(x, y, 'o')
        else:
            xs = range(min(x0,x1), max(x0,x1)+1)
            for x in xs:
                t = 0 if x1 == x0 else (x-x0)/(x1-x0)
                cy = y0+(y1-y0)*t; w = w0+(w1-w0)*t
                u = round(cy-w/2); d = u+max(1,round(w))-1
                for y in range(u, d+1):
                    k = y-u; n = d-u+1
                    s.px(x, y, hi if k == 0 else lo if k >= n-(2 if n >= 5 else 1) else mid)
                s.px(x, u-1, 'o'); s.px(x, d+1, 'o')
            if cap:
                for x, yy in ((min(x0,x1)-1, y0 if x0 < x1 else y1), (max(x0,x1)+1, y1 if x0 < x1 else y0)):
                    w = w0 if yy == y0 else w1
                    u = round(yy-w/2)
                    for y in range(u, u+round(w)): s.px(x, y, 'o')
    def save(s, path, pal='pal_hero.txt'): save(s.c, path, pal)

def _inpoly(pts, px, py):
    ins = False; j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]; xj, yj = pts[j]
        if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi) + xi: ins = not ins
        j = i
    return ins
def poly(g, pts, col):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    for y in range(int(min(ys)) - 1, int(max(ys)) + 2):
        for x in range(int(min(xs)) - 1, int(max(xs)) + 2):
            if _inpoly(pts, x + .5, y + .5):
                c = col(x, y) if callable(col) else col
                if c: g.px(x, y, c)
def ell(g, cx, cy, rx, ry, col):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1:
                c = col(x, y) if callable(col) else col
                if c: g.px(x, y, c)
def outline(g, k='o'):
    add = []
    for y in range(g.h):
        for x in range(g.w):
            if g.c[y][x] != '.': continue
            if any(g.get(x+a, y+b) not in ('.',) for a, b in ((1,0),(-1,0),(0,1),(0,-1))): add.append((x, y))
    for x, y in add: g.px(x, y, k)
def stamp(g, x, y, rows):
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch == '.': continue
            g.px(x + i, y + j, '.' if ch == '_' else ch)
