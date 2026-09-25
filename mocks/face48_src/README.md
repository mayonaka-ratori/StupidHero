# 48×48の顔を入れた画面の写真(`mocks/face48.html`の「画面全体で見る」)

`game.patch`は、写真を撮るために手元のゲームを一時的に書きかえた差分です(コミットしていない)。顔のシートを48×48にし(`src/art/sheets.ts`)、会話の窓の顔を48にして(`src/ui/cutin.ts`)、縦長の画面の会話の窓の高さを変えています(`src/scenes/Street.ts`、`src/scenes/Intro.ts`)。`?face48=2`をURLに付けると、セリフを顔の右に出す窓2になります。

撮り直すときは、`git apply mocks/face48_src/game.patch`をしてから、`face_hero.png`と`face_operator.png`を`public/art/`に置きます。撮り終わったら、`git checkout -- src public/art/manifest.json`で元にもどし、置いたPNGを消します。

| ファイル | 中身 |
|---|---|
| `street_now.png`、`street_1.png`、`street_2.png` | 結果発表(いま、窓1、窓2) |
| `intro_now.png`、`intro_1.png`、`intro_2.png` | ステージ前の掛け合い(いま、窓1、窓2) |
