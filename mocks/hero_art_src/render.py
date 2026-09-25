# 文字の表 -> PNG(拡大)。使い方: python3 render.py name.txt scale
import sys
from PIL import Image
L=[0,36,73,109,146,182,219,255]
def md(r,g,b): return (L[r],L[g],L[b])
def load(path):
    pal={}; rows=[]; mode=None
    for line in open(path,encoding='utf-8'):
        line=line.rstrip('\n')
        if line.startswith('#'): continue
        if line.startswith('PAL '):
            _,k,v=line.split(' ',2); pal[k]=md(*map(int,v.split(','))); continue
        if line.startswith('|'): rows.append(line[1:].rstrip('|'))
    return pal,rows
def img(path,scale):
    pal,rows=load(path)
    w=max(len(r) for r in rows); h=len(rows)
    im=Image.new('RGBA',(w,h),(58,52,82,255))
    for y,r in enumerate(rows):
        for x,ch in enumerate(r):
            if ch in '. ': continue
            if ch not in pal: raise SystemExit(f'unknown {ch!r} at {x},{y}')
            im.putpixel((x,y),pal[ch]+(255,))
    return im.resize((w*scale,h*scale),Image.NEAREST), len(set(v for v in pal.values()))
if __name__=='__main__':
    out=[]
    for p in sys.argv[1:-1]:
        im,n=img(p,int(sys.argv[-1])); out.append(im); print(p,im.size,'colors',n)
    W=sum(i.width for i in out)+10*len(out); H=max(i.height for i in out)
    sheet=Image.new('RGBA',(W,H),(40,36,56,255)); x=0
    for i in out: sheet.paste(i,(x,0)); x+=i.width+10
    sheet.save('view.png')
