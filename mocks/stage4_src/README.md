# ステージ4(高層ビル)の見本の絵(`mocks/stage4/`)の元

ゲームの人と同じ描き方(`src/art/world/figure.ts`の`drawPerson`)で描いた見本です。ゲームには入っていません。

| ファイル | 中身 |
|---|---|
| `people.ts` | 新しい人8種類(花屋の店員、配達員、新人の会社員、清掃員、シェフ、ウェイター、ドレスの女性、手品師) |
| `scenes.ts` | 1階のロビー、パーティ会場、エレベーターの中、仕分けの画面での見え方、人の一覧。背景は見本なので216×214の1枚に直接描いている |
| `build.mjs` | PNGを`mocks/stage4/`に書き出す |

作り直すときは`node mocks/stage4_src/build.mjs`を動かします。見比べのページは`mocks/stage4/index.html`です。
