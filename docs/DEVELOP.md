# 開発の手引き

ゲームの中身の決まりは`docs/SPEC.md`(ステージ1と全体)、`docs/STAGE2.md`(ステージ2)、`docs/STAGE3.md`(ステージ3)、絵の決まりは`docs/ART_SPEC.md`にあります。手元で動かすコマンド(`npm ci`、`npm run dev`など)は`README.md`の「手元で動かす」にあります。ここには、コードをさわるときに知っておくと早いことを書きます。

コードの説明は、それぞれのファイルの先頭にくわしく書いてあります。ここはその地図です。

## フォルダの中身

| 場所 | 中身 |
|---|---|
| `index.html` | ゲームのページ。共有されたときの画像や説明もここに書いてある |
| `src/main.ts` | 入口。Phaserを起動して、場面(シーン)を並べる |
| `src/config.ts` | 画面の大きさ、字のフォント、UIの色、シーンの名前 |
| `src/layout.ts`、`src/hires.ts` | 画面の大きさの決め方と、字を細かく描く仕組み |
| `src/run.ts` | 1回のプレイの状態。シーンの間はこれで受け渡す。波のあとの行き先(`nextAfterStreet`、`nextAfterReview`)もここ |
| `src/settings.ts` | 一時停止のメニューで切りかえる設定(光と揺れを弱くする、ゆっくりモード)。そのスマホの中に覚える |
| `src/logic/` | ルール、数字、文章、記録。Phaserを使わないので、テストはここに集まっている |
| `src/scenes/` | 場面ごとの画面。大きい場面は小文字のフォルダに部品を分けている(`sort/`、`street/`、`boss/`、`review/`、`result/`、`stageselect/`)。結果発表のギャング、UFO、タイムセールラッシュは`street/gang.ts`、`street/ufo.ts`、`street/rush.ts` |
| `src/ui/` | ボタン、吹き出し、カットイン、字、一時停止のメニュー(`pause.ts`)、画面の切り替え(`transition.ts`)、光と揺れ(`fx.ts`)などの画面の部品 |
| `src/art/` | 絵。いまは全部コードで描いている。`hero/`がヒーローと顔とエフェクト、`world/`がステージ1、`world2/`がステージ2、`world3/`がステージ3。シートの表は`sheets.ts`、「持ち物」の窓の四角は`clueSpots.ts`、ステージ2の小物の塗り替えは`recolor.ts` |
| `src/audio/` | 曲と効果音。Web Audioでその場で作る |
| `src/dev/`、`dev/` | 開発用のページ(絵、音、UI、文字の一覧)。公開するゲームには入らない |
| `tools/` | ブラウザでゲームを動かして確かめるスクリプト |
| `public/` | そのまま公開するファイル。共有用の画像`og.png`と、差し替える絵の置き場`art/` |
| `mocks/` | 画面の向きを決めたときのモック |
| `.github/workflows/` | pushのたびに動くテスト(`test.yml`)と、公開(`pages.yml`) |

## 場面の流れ

```
Boot→Title→StageSelect→Intro
  →Sort(波1)→Street(波1)→WaveReview(波1)
  →Sort(波2)→Street(波2)→WaveReview(波2)
  →Sort(波3)→Street(波3)→Boss→WaveReview(波3)
  →Result→(もう一回ならIntro、タイトルへならTitle)
```

- まだどのステージも遊んでいない人は、`Title`から`StageSelect`をとばして路地裏へ行く
- そのステージの掛け合いを見たか、一度遊んだことがあれば、`Intro`はとばしてすぐ`Sort`へ行く。`Title`と`StageSelect`は`src/scenes/Intro.ts`の`entrySceneFor`で行き先を決める。`Result`の「もう一回」は`Intro`へ行き、`Intro`が何も出さずに`Sort`へ進む(見たかどうかは記録の`introSeen`)
- `Street`のあとの行き先は`nextAfterStreet`(波1と波2は`WaveReview`、波3は`Boss`)。`WaveReview`のあとは`nextAfterReview`(次の波の`Sort`か`Result`。波を進めるのはここ)
- ショッピングモールの波2では、`Street`の中で結果発表のあとにタイムセールラッシュをする。別のシーンではない(`src/scenes/street/rush.ts`の`stepRush`など)
- `Result`から`TitleList`を開くと、`Result`は眠らせておき、もどると元のまま起こす

| シーン | 画面 |
|---|---|
| Boot | 読み込み。絵を用意して、字を読み込む |
| Title | タイトル。ここで音を鳴らし始める |
| StageSelect | ステージを選ぶ |
| Intro | ステージ前の掛け合い |
| Sort | 仕分け |
| Street | 結果発表(ヒーローが仕分け通りに動く)。モールの波2はタイムセールラッシュも |
| Boss | ボス戦 |
| WaveReview | 波ごとの答え合わせ |
| Result | 結果画面と共有 |
| TitleList | 称号の一覧(結果画面から開く) |

ほかのシーンの上に重ねて出すシーンが2つあります。

| シーン | 中身 |
|---|---|
| `UiPause` | 一時停止のメニュー。掛け合い、仕分け、結果発表、ボス戦の上に出す(`src/ui/pause.ts`) |
| `UiWipe` | 画面の切り替えのワイプ(`src/ui/transition.ts`の`goto`) |

画面の担当は、数字や文章を自分で書かずに`src/logic/`から読みます。

- 数字:`rules.ts`(ステージごとの違いは`stages.ts`)
- 文章:`content.ts`(ステージ2の文は`garageContent.ts`、ステージ3の文は`mallContent.ts`)
- 人の並び:`stage.ts`(ステージ2は`garage.ts`、ステージ3は`mall.ts`)
- ステージ2のギャングの組:`gang.ts`。ステージ3のUFO:`ufo.ts`
- ボス戦:`boss.ts`
- 称号:`titles.ts`
- 数え方:`stats.ts`
- 答え合わせの決め手:`reasons.ts`
- 金額の書き方と被害額のたとえ:`format.ts`
- 共有の文:`share.ts`
- 記録:`records.ts`

呼ぶ順番の例は`src/logic/index.ts`の先頭にあります。

## 途中の場面から始める

開発用のサーバー(`npm run dev`)で開いたときだけ、URLの後ろに書いた場面から始められます。公開した版では効きません。

| 書き方 | 意味 |
|---|---|
| `?scene=Sort` | 始める場面。`Intro`、`Sort`、`Street`、`Boss`、`WaveReview`、`Result`、`TitleList`など。`Intro`は見たことがあっても毎回出る |
| `&stage=garage` | ステージ2で始める(鍵が開いていなくてもよい)。`&stage=mall`でステージ3。書かなければ路地裏 |
| `&wave=2` | 始める波(1〜3)。書かなければ1、`Boss`と`Result`のときは3 |
| `&seed=123` | 人の並びを決める種。同じ種なら毎回同じ並びになる。書かなければ12345 |
| `&sorts=truth` | 飛ばした波の仕分けの決め方。`truth`全部正しく、`random`でたらめ(書かないときはこれ)、`bad`全員ワル、`civ`全員市民 |
| `&attack=punch` | 結果発表でヒーローがワルを殴るときの技を決める。`charge`、`punch`、`stomp`、`special` |

例:

- `http://localhost:5173/?scene=Street&wave=3&sorts=civ`(ボスを市民にした波3の結果発表)
- `http://localhost:5173/?scene=Boss&stage=garage`(女ボスとのボス戦)
- `http://localhost:5173/?scene=WaveReview&wave=2&sorts=random`(波2の答え合わせ)
- `http://localhost:5173/?scene=Street&stage=mall&wave=1&sorts=civ`(宇宙人を見逃して、UFOが来るモールの結果発表)
- `http://localhost:5173/?scene=Street&stage=mall&wave=2&sorts=truth`(波2の結果発表のあとにタイムセールラッシュ)
- `http://localhost:5173/?scene=Boss&stage=mall`(宇宙人の親玉とのボス戦。体力が半分を切ると母艦に乗りこむ)

結果画面には見本の数字があります(`src/scenes/result/sample.ts`)。

| 書き方 | 出る称号 |
|---|---|
| `?scene=Result&sample=granny` | おばあちゃんの敵(書かないときはこれ) |
| `?scene=Result&sample=demolition` | 歩く解体工事 |
| `?scene=Result&sample=flawless` | 完全無欠のヒーロー |
| `?scene=Result&sample=runaway` | 正義の暴走機関車 |
| `?scene=Result&sample=kind` | やさしすぎるヒーロー |
| `?scene=Result&sample=roundup&stage=garage` | 一網打尽 |
| `?scene=Result&sample=driver&stage=garage` | ギャングの見送り係 |
| `?scene=Result&sample=guide&stage=mall` | 宇宙人の案内係 |
| `?scene=Result&sample=sale&stage=mall` | タイムセールの守り神 |
| `?scene=Result&sample=hunter&stage=mall` | UFOハンター |

- `&stage=garage`や`&stage=mall`をつけて`sample`を書かないときは、そのステージのふつうの見本になる(モールは買い物客が1人さらわれた数字)
- 路地裏の見本に`&unlock=1`を足すと、「地下駐車場が開いた」の知らせも出ます。地下駐車場の見本に足すと「モールが開いた」です(例:`?scene=Result&sample=roundup&stage=garage&unlock=1`)
- 見本は本当の記録を書きかえません(その場かぎりの記録に書く)。前の記録を入れてあるので、NEWの印が出る。`&new=0`で前の記録を入れない

開発用のサーバーでは、ブラウザの開発ツールからゲームの中身をさわれます(`tools/`のスクリプトが使う)。

| 名前 | 中身 |
|---|---|
| `window.__game` | ゲーム全体 |
| `window.__sh` | タイトル、ステージを選ぶ画面、掛け合い、仕分けの中身 |
| `window.streetDev` | 結果発表のシーン |
| `window.bossScene` | ボス戦のシーン(途中の場面から始めたときだけ) |
| `window.reviewDev` | 答え合わせ |
| `window.resultDev` | 結果画面 |
| `window.titleListDev` | 称号の一覧 |
| `window.pauseDev` | 一時停止のメニューのボタン |

そのスマホの中に覚えるもの(localStorage):

| キー | 中身 |
|---|---|
| `stupidhero.settings.v1` | 設定 |
| `stupidhero.records.v2` | 記録(称号、掛け合いを見たか`introSeen`、ラッシュを見たか`rushSeen`も) |
| `stupidHero.muted` | 音を切ったか |

初めての人の流れ(ステージ選びをとばす、掛け合いを出す)を見直すときは、記録を消してから開きます(古い`stupidhero.records.v1`が残っていれば、それも消す。あると読みこんで遊んだことになる)。

## 開発用のページ

開発用のサーバーで開きます。

| ページ | 中身 |
|---|---|
| `/dev/art.html` | 絵の一覧。`?keys=hero,fx_aura`で絞りこみ、`?scale=3`で拡大。ゲームと同じく`public/art/`のPNGを読み、PNGで差し替わった絵はキーの横に「PNG」と出す |
| `/dev/audio.html` | 曲と効果音を1つずつ鳴らす。「数字で確かめる」で音の大きさを表にする |
| `/dev/ui.html` | UIの部品。`?page=sort`、`result`、`parts`、`swipe`、`text` |
| `/dev/text.html` | ゲームに出る文を並べる。`?set=check`で禁則のまちがいだけを並べる |

## テスト

```sh
npm test            # vitest。src/の*.test.tsを全部動かす
npm run typecheck   # tsc
```

pushするたびに、GitHub Actions(`.github/workflows/test.yml`)で同じ2つが動きます。

`src/art/artRules.test.ts`は、コードで描いた絵の全部(ヒーロー、ステージ1〜3)が`docs/ART_SPEC.md`の色の決まりを守っているかを見るテストです。1枚15色まで、8段階の色だけ、明るい緑なし、赤紫はステージ2の人の小物だけ、黄緑の3色はステージ3だけ、背景は3枚で45色まで、奥の背景に透明なし、を確かめます。絵を描き足したり直したりしたら、これが通るかを見ます。

`src/logic/published.test.ts`は、公開した版とステージ1の中身が変わっていないかを比べるテストです。答えは`src/logic/fixtures/`のJSONに入っています。このJSONは作り直さないでください。ステージ1の中身をわざと変えたときだけ、理由を書いて作り直します。仕分けの見直しで、波の時間、プロフィールの一文、オペレーターの一言はわざと変えたので、JSONは作り直さずに、それらを比べる項目から外してあります。

## ブラウザで確かめるスクリプト(tools/)

Playwrightで、スマホの大きさのブラウザを開いて指で操作します。CIでは動かさないので、手元で動かします。

動かし方:

1. 先に開発用のサーバーを立てる(`npm run dev`。ふつうは`http://localhost:5173/`で開く)
2. 別の窓でスクリプトを動かす(例:`node tools/textcheck.mjs`、`node tools/playthrough.mjs - - 5 mall truth`)

どのスクリプトも、ふつうは`http://localhost:5173/`のサーバーを開き、撮った画像を`shots/`に置きます(`shots/`はgitに入れません)。ほかのポートやほかの場所のサーバーを使うときは、環境変数`DEV_URL`に入れるか、引数で渡します(数字だけならポートとして読む)。画像の置き場所は、環境変数`SHOTS_DIR`か引数で変えられます。引数を省くかわりに`-`と書くと、ふつうの値になります。

使い方の引数は、各ファイルの先頭にくわしく書いてあります。NGが1つでもあると、終了コード1で終わります。

ブラウザの場所は`tools/lib.mjs`の`CHROME`で決まります。ふだんはClaude Codeのクラウドの環境に入っているChromiumを使います。ほかの場所で動かすときは、環境変数`CHROME`にブラウザの場所を入れて動かします(例:`CHROME=/usr/bin/chromium node tools/uitest.mjs`)。どちらもなければ、playwright-coreが自分でブラウザを探します。

`playwright-core`は1.56に止めています。クラウドの環境に入っているChromiumの版(1194)に合わせているためです。上げるときは、そのブラウザも合わせて変えます。

| スクリプト | ステージ | すること |
|---|---|---|
| `playthrough.mjs` | `alley`、`garage`、`mall` | タイトルから結果画面まで自動で通しで遊び、エラーが出ないか見る。場面ごとに画面を撮る。答え合わせでは次へを押して進み、波1〜3の3回とも通ったかも見る。仕分けの決め方(`random`、`truth`、宇宙人を見逃してUFOを呼ぶ`ufo`、ボスを市民にする`bossciv`。`ufo+bossciv`のようにつなげられる)を選べる。地下駐車場とモールは、前のステージを倒した記録を入れてからステージを選ぶ画面で選ぶ。結果画面の共有カードと、いちばんひどい場面の写真も書き出す |
| `sort_drive.mjs` | URLで決める | 手順を並べて指で動かし、撮ったり式を調べたりする |
| `street_tap.mjs` | `alley`、`garage`、`mall` | 結果発表で、中断と「つづける」(一時停止のメニュー)、早送り、待て、行けが効くか試す。地下駐車場は仲間が集まったところとワゴンに乗ったところの行け、モールはUFOを行けで落とす、押さずにさらわれる、タイムセールラッシュ(市民にだけ待て。エスカレーターが壊れないまま始まるか、長さが約16秒か)も試す |
| `boss_test.mjs` | `alley`、`garage`、`mall` | ボス戦を連打で試す。放っておいても15秒で終わるか、一時停止で時計が止まるか、倒したあと答え合わせ(WaveReview)へ行くかも見る。地下駐車場とモールは、体力が半分を切ると車(母艦)に乗りこむところと、手が止まったときの被害額(乗る前¥50万、車¥100万、母艦¥150万が1秒ごと)、モールは倒すと噴水の¥150万が足されるかも見る |
| `result_sharetest.mjs` | `alley`、`garage`、`mall` | 結果画面の共有ともう一回を試す(共有メニューがあるとき、ないとき、キャンセルされたとき、失敗したとき、パソコン)。共有の文が見出し、#StupidHero、URLの3行か、「画像を保存」でPNGを保存できるかも見る |
| `result_shot.mjs` | URLの後ろに`stage=`を書く | 結果画面と共有カードの画像を書き出す |
| `result_og.mjs` | | 共有用の画像`public/og.png`をゲームの絵で作り直す |
| `textcheck.mjs` | | ゲームの全部の文を折り返して、禁則のまちがいがないか見る |
| `audioCheck.mjs` | | 曲と効果音の音の大きさを測り、音が割れていないか、無音でないかを見る |
| `uitest.mjs` | | UIの部品(`/dev/ui.html`)をタッチで試す |
| `shot.mjs` | URLで決める | 1枚だけ画面を撮る |
| `timeshots.mjs` | URLで決める | 決めた時間ごとに画面を撮る |
| `lib.mjs` | | 上のスクリプトで共通に使う部品 |

## 文章を書くときの決まり

`src/logic/content.ts`の先頭に書いてある決まりを守ります。

- 1行は全角12文字まで、1つのセリフは2行まで(改行は`\n`)
- 半角スペースとエムダッシュは使わない
- 2人の名前はまだ決まっていないので、文の中で名前を呼ばない
- ヒーローは元気で大げさで自信満々、オペレーターはため口でツッコむ幼なじみ

文を足したり直したりしたら、`tools/textcheck.mjs`で禁則を確かめます。

## 絵を差し替える

いまの絵は全部コードで描いています。PNGを用意すれば、そのキーだけ差し替わります。

1. `docs/ART_SPEC.md`の決まり(大きさ、色、並べ方)に合わせてPNGを作る
2. `public/art/<キー>.png`に置く(例:`public/art/hero.png`)
3. `public/art/manifest.json`に、そのキーを書き足す。コマに分かれた絵は`sheets`、1枚の絵(背景とロゴ)は`images`に入れる

```json
{ "sheets": ["hero", "face_hero"], "images": ["logo"] }
```

キーとコマの大きさは`src/art/sheets.ts`の表で決まっています(`SHEETS`と`IMAGES`)。表にないキーは読み込みません。読み込みは`src/scenes/Boot.ts`がします(読み方は`src/art/index.ts`の`loadArtPngs`)。

置いたら、まず`/dev/art.html`で確かめます。差し替わった絵は、キーの横に緑で「PNG」と出ます。PNGの大きさが決まりとちがうときは赤で大きさが出て、読めなかったときは「PNGが読めない」と出ます。どちらのときも、ゲームではそのPNGを使わずにコードで描いた絵にもどります(ブラウザのコンソールにも出ます)。コマの区切りの線も出るので、コマがずれていないかも見ます。そのあとゲームの画面でも確かめます(例:`?scene=Sort&stage=mall`や`?scene=Street&wave=1&sorts=civ`)。

## 公開する

公開は`.github/workflows/pages.yml`で、GitHub Pagesに出します。作りかけが出ないように、手で動かしたときだけ公開します。

1. GitHubのActionsの画面で「Pages」を選び、「Run workflow」を押す
2. 「公開する版」に、公開したいコミット(かタグかブランチ)を入れる。最初から入っているのは、いま公開している版
3. テスト(`npm test`)と組み立て(`npm run build`。型の確かめもする)が通ると公開される

公開したら、`pages.yml`の`default`を公開した版のコミットに書きかえてコミットします(次に動かすときの既定になり、いまどの版を公開しているかも分かる)。いまの`default`は、ステージ1から3と、コードの見直し、起動を速くする変更、共有用の画像の作り直しを入れた`31c4005`です。

新しいリポジトリで初めて動かすときだけ、GitHubの Settings → Pages → Source を「GitHub Actions」にしておきます。

共有されたときに出る画像`public/og.png`は、絵を変えたら`tools/result_og.mjs`で作り直します。
