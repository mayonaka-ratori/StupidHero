# 開発の手引き

ゲームの中身の決まりは`docs/SPEC.md`(ステージ1)、`docs/STAGE2.md`(ステージ2)、`docs/STAGE3.md`(ステージ3)、絵の決まりは`docs/ART_SPEC.md`にあります。ここには、コードをさわるときに知っておくと早いことを書きます。

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
| `src/scenes/` | 場面ごとの画面。大きい場面は同じ名前のフォルダに部品を分けている |
| `src/ui/` | ボタン、吹き出し、カットイン、字、一時停止のメニュー(`pause.ts`)、光と揺れ(`fx.ts`)などの画面の部品 |
| `src/art/` | 絵。いまは全部コードで描いている。`world/`がステージ1、`world2/`がステージ2 |
| `src/audio/` | 曲と効果音。Web Audioでその場で作る |
| `src/dev/`、`dev/` | 開発用のページ(絵、音、UI、文字の一覧)。公開するゲームには入らない |
| `tools/` | ブラウザでゲームを動かして確かめるスクリプト |
| `public/` | そのまま公開するファイル。共有用の画像`og.png`と、差し替える絵の置き場`art/` |
| `mocks/` | 画面の向きを決めたときのモック |

## 場面の流れ

```
Boot→Title→StageSelect→Intro
  →Sort(波1)→Street(波1)→WaveReview(波1)
  →Sort(波2)→Street(波2)→WaveReview(波2)
  →Sort(波3)→Street(波3)→Boss→WaveReview(波3)
  →Result→(もう一回ならIntro、タイトルへならTitle)
```

- まだどのステージも遊んでいない人は、`Title`から`StageSelect`をとばして路地裏の`Intro`へ行く
- `Intro`は、そのステージの掛け合いを見たか一度遊んだことがあれば、何も出さずにすぐ`Sort`へ行く(`src/scenes/Intro.ts`の`entrySceneFor`。見たかどうかは記録の`introSeen`)
- `Street`のあとの行き先は`nextAfterStreet`(波1と波2は`WaveReview`、波3は`Boss`)。`WaveReview`のあとは`nextAfterReview`(次の波の`Sort`か`Result`。波を進めるのはここ)
- `Result`から`TitleList`を開くと、`Result`は眠らせておき、もどると元のまま起こす

| シーン | 画面 |
|---|---|
| Boot | 読み込み。絵を用意して、字を読み込む |
| Title | タイトル。ここで音を鳴らし始める |
| StageSelect | ステージを選ぶ |
| Intro | ステージ前の掛け合い |
| Sort | 仕分け |
| Street | 結果発表(ヒーローが仕分け通りに動く) |
| Boss | ボス戦 |
| WaveReview | 波ごとの答え合わせ |
| Result | 結果画面と共有 |
| TitleList | 称号の一覧(結果画面から開く) |

一時停止のメニューは、掛け合い、仕分け、結果発表、ボス戦の上に重ねて出す`UiPause`というシーンです(`src/ui/pause.ts`)。

画面の担当は、数字や文章を自分で書かずに`src/logic/`から読みます。

- 数字:`rules.ts`(ステージごとの違いは`stages.ts`)
- 文章:`content.ts`(ステージ2の文は`garageContent.ts`、ステージ3の文は`mallContent.ts`)
- 称号:`titles.ts`
- 数え方:`stats.ts`
- 答え合わせの決め手:`reasons.ts`
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
| `&seed=123` | 人の並びを決める種。同じ種なら毎回同じ並びになる |
| `&sorts=truth` | 飛ばした波の仕分けの決め方。`truth`全部正しく、`random`でたらめ(書かないときはこれ)、`bad`全員ワル、`civ`全員市民 |

例:

- `http://localhost:5173/?scene=Street&wave=3&sorts=civ`(ボスを市民にした波3の結果発表)
- `http://localhost:5173/?scene=Boss&stage=garage`(女ボスとのボス戦)
- `http://localhost:5173/?scene=WaveReview&wave=2&sorts=random`(波2の答え合わせ)

結果画面には見本の数字があります(`src/scenes/result/sample.ts`)。

| 書き方 | 出る称号 |
|---|---|
| `?scene=Result&sample=granny` | おばあちゃんの敵(書かないときはこれ) |
| `?scene=Result&sample=demolition` | 歩く解体工事 |
| `?scene=Result&sample=flawless` | 完全無欠のヒーロー |
| `?scene=Result&sample=runaway` | 正義の暴走機関車 |
| `?scene=Result&sample=kind` | やさしすぎるヒーロー |
| `?scene=Result&sample=roundup&stage=garage` | 一網打尽 |
| `?scene=Result&sample=driver&stage=garage` | ギャングの運転手 |

路地裏の見本に`&unlock=1`を足すと、「地下駐車場が開いた」の知らせも出ます。

開発用のサーバーでは、ブラウザの開発ツールから`window.__game`でゲームの中身を見られます。一時停止のメニューのボタンは`window.pauseDev`、答え合わせは`window.reviewDev`、称号の一覧は`window.titleListDev`からさわれます(`tools/`のスクリプトが使う)。

設定はlocalStorageの`stupidhero.settings.v1`、記録は`stupidhero.records.v2`に入っています。初めての人の流れ(ステージ選びをとばす、掛け合いを出す)を見直すときは、記録を消してから開きます(古い`stupidhero.records.v1`が残っていれば、それも消す。あると読みこんで遊んだことになる)。

## 開発用のページ

開発用のサーバーで開きます。

| ページ | 中身 |
|---|---|
| `/dev/art.html` | 絵の一覧。`?keys=hero,fx_aura`で絞りこみ、`?scale=3`で拡大 |
| `/dev/audio.html` | 曲と効果音を1つずつ鳴らす。「数字で確かめる」で音の大きさを表にする |
| `/dev/ui.html` | UIの部品。`?page=sort`、`result`、`parts`、`swipe`、`text` |
| `/dev/text.html` | ゲームに出る文を並べる。`?set=check`で禁則のまちがいだけを並べる |

## テスト

```sh
npm test            # vitest。src/の*.test.tsを全部動かす(いまは22ファイル、241件)
npm run typecheck   # tsc
```

pushするたびに、GitHub Actions(`.github/workflows/test.yml`)で同じ2つが動きます。

`src/logic/published.test.ts`は、公開した版とステージ1の中身が変わっていないかを比べるテストです。答えは`src/logic/fixtures/`のJSONに入っています。このJSONは作り直さないでください。ステージ1の中身をわざと変えたときだけ、理由を書いて作り直します。仕分けの見直しで、波の時間、プロフィールの一文、オペレーターの一言はわざと変えたので、JSONは作り直さずに、それらを比べる項目から外してあります。

## ブラウザで確かめるスクリプト(tools/)

Playwrightで、スマホの大きさのブラウザを開いて指で操作します。CIでは動かさないので、手元で動かします。

動かし方:

1. 先に開発用のサーバーを立てる。ポートはスクリプトごとに決まっていて、各ファイルの先頭に書いてある(例:`npx vite --port 5205 --strictPort`)
2. 別の窓でスクリプトを動かす(例:`node tools/textcheck.mjs http://localhost:5205/`)

NGが1つでもあると、終了コード1で終わります。ブラウザの場所は`tools/lib.mjs`の`CHROME`に書いてあります(Claude Codeのクラウドの環境に入っているChromium)。ほかの場所で動かすときはここを書きかえます。

| スクリプト | すること |
|---|---|
| `playthrough.mjs` | タイトルから結果画面まで自動で通しで遊び、エラーが出ないか見る。場面ごとに画面を撮る。答え合わせでは次へを押して進み、波1〜3の3回とも通ったかも見る |
| `sort_drive.mjs` | 手順を並べて指で動かし、撮ったり式を調べたりする |
| `street_tap.mjs` | 結果発表で、中断と「つづける」(一時停止のメニュー)、早送り、待て、行けが効くか試す |
| `boss_test.mjs` | ボス戦を連打で試す。放っておいても15秒で終わるか、一時停止で時計が止まるか、倒したあと答え合わせ(WaveReview)へ行くかも見る |
| `result_sharetest.mjs` | 結果画面の共有ともう一回を試す(共有メニューがあるとき、ないとき、キャンセルされたとき、失敗したとき、パソコン)。共有の文が見出し、#StupidHero、URLの3行か、「画像を保存」でPNGを保存できるかも見る |
| `result_shot.mjs` | 結果画面と共有カードの画像を書き出す |
| `result_og.mjs` | 共有用の画像`public/og.png`をゲームの絵で作り直す |
| `textcheck.mjs` | ゲームの全部の文を折り返して、禁則のまちがいがないか見る |
| `audioCheck.mjs` | 曲と効果音の音の大きさを測り、音が割れていないか、無音でないかを見る |
| `uitest.mjs` | UIの部品をタッチで試す |
| `shot.mjs` | 1枚だけ画面を撮る |
| `timeshots.mjs` | 決めた時間ごとに画面を撮る |
| `lib.mjs` | 上のスクリプトで共通に使う部品 |

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
3. `public/art/manifest.json`に、そのキーを書き足す。コマに分かれた絵は`sheets`、1枚の絵は`images`に入れる

```json
{ "sheets": ["hero", "face_hero"], "images": ["logo"] }
```

キーとコマの大きさは`src/art/sheets.ts`の表で決まっています。表にないキーは読み込みません。書き足したら`/dev/art.html`で見て確かめます。

## 公開する

公開は`.github/workflows/pages.yml`で、GitHub Pagesに出します。作りかけが出ないように、手で動かしたときだけ公開します。

1. GitHubのActionsの画面で「Pages」を選び、「Run workflow」を押す
2. 「公開する版」に、公開したいコミット(かタグかブランチ)を入れる。最初から入っているのは、いま公開している版
3. テストと組み立てが通ると公開される

公開したら、`pages.yml`の`default`を公開した版のコミットに書きかえてコミットします(次に動かすときの既定になり、いまどの版を公開しているかも分かる)。

共有されたときに出る画像`public/og.png`は、絵を変えたら`tools/result_og.mjs`で作り直します。
