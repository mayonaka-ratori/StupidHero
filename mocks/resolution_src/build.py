import base64, json, os
names = ['sc_now', 'sc_A', 'sc_B', 'sc_C'] + [f'{p}_{n}' for p in ('hi', 'hp', 'cv') for n in (54, 90, 108)]
IMG = {n: base64.b64encode(open(f'{n}.png', 'rb').read()).decode() for n in names}
tpl = open('page.html', encoding='utf-8').read()
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'resolution.html')
open(OUT, 'w', encoding='utf-8').write(tpl.replace('/*IMG*/null', json.dumps(IMG)))
print(sum(len(v) for v in IMG.values()))
