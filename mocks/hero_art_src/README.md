# ヒーローの絵の見直し案(`mocks/hero_art.html`)の元

モックの絵は、1ドットずつ文字の表で打っています。1文字が1ドットで、色は`pal_hero.txt`と`pal_op.txt`の表で決めます。

| ファイル | 中身 |
|---|---|
| `idle.py`、`punch.py` | ヒーローの体の1回目(待機とパンチ)。`python3 idle.py`で`idle.txt`を書き出す |
| `idle2.py`、`punch2.py` | 2回目(磨いた版)。1回目の`idle.txt`、`punch.txt`を元に描き直して、`idle2.txt`、`punch2.txt`を書き出す |
| `fh_hand.py`、`fh_hand2.py` | ヒーローの顔(3つの表情、口を閉じた顔と開けた顔)。`fh_hand2.py`が2回目 |
| `op.py` | オペレーターの顔(4つの表情) |
| `compose.py` | 部品を重ねる道具 |
| `render.py` | 表を拡大したPNGにして見る(`python3 render.py idle.txt 8`で`view.png`)。Pillowが要る |
| `build.py`、`page.html` | 絵をページに入れて`mocks/hero_art.html`を作る |
| `base_*.txt`、`cur_face_*.json` | 比べるための、いまの絵 |

作り直すときは、`idle.py`、`punch.py`、`idle2.py`、`punch2.py`、`fh_hand2.py`、`op.py`を順に動かしてから`build.py`を動かします。

## 48×48の顔(`mocks/face48.html`)

| ファイル | 中身 |
|---|---|
| `face48.py` | ヒーローの48×48の顔。`f48h*.txt`を書き出す |
| `op48.py` | オペレーターの48×48の顔。`f48o*.txt`を書き出す |
| `build48.py`、`page48.html` | 32×32(`fh_hand2.py`と`op.py`が書き出すもの)と48×48を並べて、`mocks/face48.html`を作る |
