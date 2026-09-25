import json
L = [0, 36, 73, 109, 146, 182, 219, 255]
def load(path):
    pal = {}; rows = []
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        if line.startswith('PAL '):
            _, k, v = line.split(' ', 2); r, g, b = map(int, v.split(',')); pal[k] = '#%02x%02x%02x' % (L[r], L[g], L[b])
        elif line.startswith('|'): rows.append(line[1:].rstrip('|'))
    return pal, rows
data = {'pal': {}, 'img': {}}
def add(name, path, pal):
    p, rows = load(path); data['pal'][pal] = p; data['img'][name] = {'p': pal, 'r': rows}
for i in range(3):
    for s in 'ab':
        add(f'h32_{i}{s}', f'fhv{i}{s}.txt', 'hero'); add(f'h48_{i}{s}', f'f48h{i}{s}.txt', 'hero')
for i in range(4):
    for s in 'ab':
        add(f'o32_{i}{s}', f'fo{i}{s}.txt', 'op'); add(f'o48_{i}{s}', f'f48o{i}{s}.txt', 'op')
js = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
tpl = open('page48.html', encoding='utf-8').read()
open('/home/user/StupidHero/mocks/face48.html', 'w', encoding='utf-8').write(tpl.replace('/*DATA*/null', js))
print(len(js))
