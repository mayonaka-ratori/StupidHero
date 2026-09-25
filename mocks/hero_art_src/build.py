import json, re
L=[0,36,73,109,146,182,219,255]
def hexc(r,g,b): return '#%02x%02x%02x'%(r,g,b)
def load(path):
    pal={}; rows=[]
    for line in open(path,encoding='utf-8'):
        line=line.rstrip('\n')
        if line.startswith('PAL '):
            _,k,v=line.split(' ',2); r,g,b=map(int,v.split(',')); pal[k]=hexc(L[r],L[g],L[b])
        elif line.startswith('|'): rows.append(line[1:].rstrip('|'))
    return pal,rows
def crop_rows(rows):  # 使っていない行と列をそのまま残す(比べやすいように同じ大きさ)
    return rows
def rgb2hex(s):
    m=re.match(r'rgb\((\d+),(\d+),(\d+)\)',s); return hexc(*map(int,m.groups()))
data={'pal':{}, 'img':{}}
def add(name, path, palname):
    pal,rows=load(path); data['pal'][palname]=pal; data['img'][name]={'p':palname,'r':rows}
add('old_idle','base_0_0.txt','hero'); add('old_punch','base_3_2.txt','hero')
add('v1_idle','idle.txt','hero'); add('v1_punch','punch.txt','hero')
add('new_idle','idle2.txt','hero'); add('new_punch','punch2.txt','hero')
for i in range(3):
    for s in 'ab': add(f'new_fh{i}{s}',f'fhv{i}{s}.txt','hero')
for i in range(4):
    for s in 'ab': add(f'new_fo{i}{s}',f'fo{i}{s}.txt','op')
for kind,short in (('hero','fh'),('operator','fo')):
    j=json.load(open(f'cur_face_{kind}.json'))
    data['pal']['old_'+short]={k:rgb2hex(v) for k,v in j['pal'].items()}
    for i,row in enumerate(j['frames']):
        for s,fr in zip('ab',row): data['img'][f'old_{short}{i}{s}']={'p':'old_'+short,'r':fr}
# 同じ文字の表をまとめて小さくする(ページを軽く)
js=json.dumps(data,ensure_ascii=False,separators=(',',':'))
tpl=open('page.html',encoding='utf-8').read()
open('/home/user/StupidHero/mocks/hero_art.html','w',encoding='utf-8').write(tpl.replace('/*DATA*/null',js))
print(len(js))
