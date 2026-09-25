# ヒーローの絵の見直し案(`mocks/hero_art.html`)の元

モックの絵は、1ドットずつ文字の表で打っています。1文字が1ドットで、色は`pal_hero.txt`と`pal_op.txt`の表で決めます。

| ファイル | 中身 |
|---|---|
| `idle.py`、`punch.py` | ヒーローの体(待機とパンチ)。`python3 idle.py`で`idle.txt`を書き出す |
| `fh_hand.py` | ヒーローの顔(3つの表情、口を閉じた顔と開けた顔) |
| `op.py` | オペレーターの顔(4つの表情) |
| `compose.py` | 部品を重ねる道具 |
| `render.py` | 表を拡大したPNGにして見る(`python3 render.py idle.txt 8`で`view.png`)。Pillowが要る |
| `build.py`、`page.html` | 絵をページに入れて`mocks/hero_art.html`を作る |
| `base_*.txt`、`cur_face_*.json` | 比べるための、いまの絵 |

作り直すときは、`idle.py`、`punch.py`、`fh_hand.py`、`op.py`を動かしてから`build.py`を動かします。
