# 開発の手引き

ゲームの中身の決まりは`docs/SPEC.md`(ステージ1と全体)、`docs/STAGE2.md`(ステージ2)、`docs/STAGE3.md`(ステージ3)、`docs/STAGE4.md`(ステージ4)、`docs/FREEPLAY.md`(フリープレイ)、絵の決まりは`docs/ART_SPEC.md`にあります。文はステージ3が`docs/STAGE3_TEXT.md`、ステージ4が`docs/STAGE4_TEXT.md`にまとめてあります。手元で動かすコマンド(`npm ci`、`npm run dev`など)は`README.md`の「手元で動かす」にあります。ここには、コードをさわるときに知っておくと早いことを書きます。

コードの説明は、それぞれのファイルの先頭にくわしく書いてあります。ここはその地図です。

## フォルダの中身

| 場所 | 中身 |
|---|---|
| `index.html` | ゲームのページ。共有されたときの画像や説明、ホーム画面のアイコン、スクリプトを読みこむ間に出す「読みこみ中…」もここに書いてある |
| `src/main.ts` | 入口。Phaserを起動して、場面(シーン)を並べる |
| `src/config.ts` | 画面の大きさ、字のフォント、UIの色、シーンの名前 |
| `src/layout.ts`、`src/hires.ts` | 画面の大きさの決め方と、字を細かく描く仕組み |
| `src/run.ts` | 1回のプレイの状態。シーンの間はこれで受け渡す。波のあとの行き先(`nextAfterStreet`、`nextAfterReview`)もここ。フリープレイを始める`startFreeRun`と、フリープレイの波のあとの行き先`nextAfterFreeStreet`もここ |
| `src/settings.ts` | 一時停止のメニューで切りかえる設定(光と揺れを弱くする、ゆっくりモード)。そのスマホの中に覚える |
| `src/logic/` | ルール、数字、文章、記録。Phaserを使わないので、テストはここに集まっている(どのファイルが何を受け持つかは下の「場面の流れ」の終わり) |
| `src/scenes/` | 場面ごとの画面。大きい場面は小文字のフォルダに部品を分けている(`sort/`、`street/`、`boss/`、`review/`、`result/`、`stageselect/`、`elevator/`)。結果発表のギャング、UFO、タイムセールラッシュ、念力は`street/gang.ts`、`street/ufo.ts`、`street/rush.ts`、`street/psychic.ts`(並べ方は`street/plan.ts`の`planTower`)、フリープレイの流れは`street/free.ts`。高層ビルの仕分けの画面の照明と机ともれは`sort/towerDesk.ts`、波の間の階の数字の場面は`Floor.ts`、エレベーターラッシュは`Elevator.ts`と`elevator/plan.ts` |
| `src/ui/` | ボタン、吹き出し、カットイン、字、一時停止のメニュー(`pause.ts`)、画面の切り替え(`transition.ts`)、光と揺れ(`fx.ts`)、煙や光の粒(`particles.ts`。動きの計算は`flow.ts`)などの画面の部品 |
| `src/art/` | 絵。いまは全部コードで描いている。`hero/`がヒーローと顔とエフェクト、`world/`がステージ1、`world2/`がステージ2、`world3/`がステージ3、`world4/`がステージ4、`free/`がフリープレイ。シートの表は`sheets.ts`、「持ち物」の窓の四角は`clueSpots.ts`(高層ビルの照明と机と小物の場所と、もれの見せ方は`towerSpots.ts`)、人の絵の塗り替え(服の色ちがいとステージ2の小物の色)は`recolor.ts`、服の色ちがいの表は`variants.ts` |
| `src/audio/` | 曲と効果音。Web Audioでその場で作る |
| `src/dev/`、`dev/` | 開発用のページ(絵、音、UI、文字の一覧)。公開するゲームには入らない |
| `tools/` | ブラウザでゲームを動かして確かめるスクリプト |
| `public/` | そのまま公開するファイル。共有用の画像`og.png`と、差し替える絵の置き場`art/` |
| `.github/workflows/` | pushのたびに動くテスト(`test.yml`)と、公開(`pages.yml`) |
| `.claude/` | Claude Codeの設定。`launch.json`は開発用のサーバーの起動、`settings.json`の`claudeMdExcludes`は、このリポジトリでは使わない全体の執筆の作法(`~/.claude/rules/writing.md`。`.md`を読むと読みこまれる)を外す。ここの`.md`は作品の本文ではないため |

絵や画面の向きを決めるときに作った見本(`mocks/`)は、決まったあとに消しました。見たいときは、gitの履歴の`5180bdd`にあります。

フリープレイのために足したファイル:

| 場所 | 中身 |
|---|---|
| `src/logic/freeplay.ts` | 数字(`FREE`)、波ごとの時間と間(`freeTiming`)、山札の並び(`createFreePlay`)、ルールとヒーローの決めつけ(`ruleAt`、`heroChoice`、`freeRoleOf`)、空押し(`DryPress`)、クリアまでの時間(`clearTimeSec`、`formatClearTime`) |
| `src/logic/freeContent.ts` | セリフ(掛け合い、決めつけ、言い直し、殴りかかる一言と素通りの一言、オペレーターの一言)と、それを選ぶ`createFreeLines` |
| `src/logic/freeNames.ts` | 名前「フリープレイ」、小物の名前、ルールの札の文(`ruleSignText`) |
| `src/scenes/street/free.ts` | 通りの流れ(`FreeStreet`)。決めつけ、待てと行け(素通りの行けも)、空押し、言い直し、悪さ、オペレーターの一言の出し方、時計 |
| `src/scenes/street/ruleSign.ts` | 左上のルールの札と、クリアまでの時間 |
| `src/scenes/street/freeItems.ts` | 波3の小物を人に重ねて動かす |
| `src/scenes/street/common.ts`の`ATTACK_GAP`、`JUDGE_RISE` | `Street.ts`と`street/free.ts`で共通の数字(殴りかかる距離、決めつけの吹き出しの高さ)。取り返しの技の当て方`HitMode`の`recover`もここ |
| `src/scenes/street/plan.ts`の`planFree` | フリープレイの並べ方(悪さの相手、ギャングが集まる場所、置く物) |
| `src/scenes/stageselect/freeButton.ts` | ステージを選ぶ画面の「フリープレイ▶」のボタン(鍵、NEW!、ベストの時間) |
| `src/scenes/result/freeStats.ts` | 結果画面の数字の窓(フリープレイ) |
| `src/scenes/result/stats.ts` | 数字の窓の、ステージとフリープレイで共通の形 |
| `src/art/free/` | 絵(一目で分かるワル、小物、ルールの札、ヒーローの光)。小物を付ける場所は`items.ts`の`itemAnchor` |
| `tools/free_play.mjs` | フリープレイを通しで遊んで確かめるスクリプト |

数え方(`stats.ts`)、称号(`titles.ts`)、記録(`records.ts`)、共有の文(`share.ts`)、共有カード(`src/scenes/result/card.ts`)は、ステージと同じファイルにフリープレイの分を足してあります。

結果発表で待てと行けを止めて教える場面(そのスマホで初めてのときだけ。`docs/SPEC.md`の「待てと行けを止めて教える」)のファイル:

| 場所 | 中身 |
|---|---|
| `src/logic/lesson.ts` | 止めて教えるかの決まり(`lessonDue`)と、オペレーターの一言(`LESSON_LINES`、8秒押さないときの`LESSON_HINTS`) |
| `src/logic/records.ts`の`needsLesson`、`markLessonSeen` | 教えたかを記録に残す(`lessonSeen`) |
| `src/scenes/street/lesson.ts` | 止める画面(`LessonPause`)。シーンの時計、動き、アニメの速さを0にして、相手とカットインと押すボタンのほかを網目で暗くする |
| `src/scenes/street/lessonLayout.ts` | 暗くする所の四角の計算(Phaserを使わない。`lessonLayout.test.ts`で確かめる) |
| `src/ui/fx.ts`の`holdScene`、`releaseScene`、`isHeld`、`fxNow`、`setSceneSpeed` | 押すまで止めておく仕組み。ヒットストップと重なっても止めを切らず、終わったらふだんの速さ(早送りなら2)に戻す。止めている間は、画面の端の点滅や揺れ、飛び出す数字も止まる |
| `src/scenes/Street.ts`の`dueLesson`、`lessonPressed`、`lessonHole` | マークが出て0.3秒後に止める、押したら戻して記録に残す、明るく残す所を決める |

ほかに、あとから足した仕組みのファイル:

| 場所 | 中身 |
|---|---|
| `src/logic/titles.ts`の`collectTitles`、`decideTitle`、`titlesAt`、`placesOf` | 当てはまった称号を全部集める、大きく出す1つを決める、場所ごとの称号と称号ごとの場所(一覧の印と「〜だけ」の札)。くわしくは`docs/SPEC.md`の「称号」と「称号の一覧」 |
| `src/scenes/Result.ts` | 結果画面の右の「ほかにも取れた」の枠も出す |
| `src/scenes/TitleList.ts`と`src/logic/records.ts`の`listSeen` | 称号の一覧と、一覧で見た称号(NEWの印を消すため) |
| `src/logic/tells.ts`と`src/art/sheets.ts`の`TELL_SHEETS` | ワルの目印の小物やくずれを、見た目ごとに2〜3通りから選ぶ(ステージ1〜3)。市民の似た小物も。絵のキーは`hoodie_bad_knuckles`のように後ろに名前がつく |
| `src/logic/colorVariants.ts`、`src/art/variants.ts`、`src/art/recolor.ts`の`personSheet` | 服の色ちがい(見た目ごとに4通り)を選ぶ、色の表、塗り替えたシートを作る(`docs/ART_SPEC.md`の「服の色ちがい」) |
| `src/scenes/sort/hudLayout.ts` | 仕分けの画面の左の列の置き方(時間の下の「▲5人ぶん」と「時計ストップ中」、見た小物の並び)。Phaserを使わないので`hudLayout.test.ts`で確かめる |
| `src/scenes/Sort.ts`の`slowHint`と`src/logic/records.ts`の`slowHintSeen` | 初めて時間切れになったときに、ゆっくりモードのことを1回だけ言う |
| `public/manifest.webmanifest`と`tools/icons.mjs` | ホーム画面に追加したときの名前とアイコン(下の「公開する」) |

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
- `Street`のあとの行き先は`nextAfterStreet`(最後の波(高層ビルは波4、ほかは波3)は`Boss`、それ以外は`WaveReview`)。`WaveReview`のあとは`nextAfterReview`(次の波の`Sort`か`Result`。波を進めるのはここ)
- ショッピングモールの波2では、`Street`の中で結果発表のあとにタイムセールラッシュをする。別のシーンではない(`src/scenes/street/rush.ts`の`stepRush`など)
- 高層ビルでは、波3の`WaveReview`のあと`nextAfterReview`が`Elevator`(エレベーターラッシュ)を返し、`Elevator`が終わると波4の`Sort`へ行く。立つ位置と時間の並びは`src/scenes/elevator/plan.ts`、始まりの帯と説明と▼タップはタイムセールラッシュと同じ`src/scenes/street/rushIntro.ts`
- `Result`、`Title`、`StageSelect`から`TitleList`を開くと、開いた画面は眠らせておき、もどると元のまま起こす

高層ビル(波が4つで、波ごとに階が変わる。`nextAfterReview`が読む`run.stage.def.floors`)は、波と波の間に階の数字だけの`Floor`をはさみます(波3のあとはラッシュがあるのではさまない)。

```
Boot→Title→StageSelect→Intro
  →Sort(波1)→Street(波1)→WaveReview(波1)→Floor(18F)
  →Sort(波2)→Street(波2)→WaveReview(波2)→Floor(35F)
  →Sort(波3)→Street(波3)→WaveReview(波3)→Elevator
  →Sort(波4)→Street(波4)→Boss→WaveReview(波4)
  →(高層ビルのボスを初めて倒したときだけEnding)→Result→(もう一回ならIntro、タイトルへならTitle)
```

フリープレイ(`run.mode`が`'free'`)は、`Sort`、`WaveReview`、`Boss`を通りません。

```
StageSelect(フリープレイ▶)→Intro(初めてのときだけ)
  →Street(波1)→Street(波2)→Street(波3)
  →Result→(もう一回ならStreet、タイトルへならTitle)
```

- `StageSelect`は`startFreeRun`をしてから、`src/scenes/Intro.ts`の`freeEntryScene`で行き先を決める(掛け合いを見たかは記録の`freeIntroSeen`)
- `Street`の流れは`src/scenes/street/free.ts`の`FreeStreet`が受け持つ(`Street.ts`の`free`)。技と吹っ飛びは`Street.ts`、ギャングの組とUFOは`street/gang.ts`と`street/ufo.ts`の部品を、ステージと同じものを使う
- `Street`のあとの行き先は`nextAfterFreeStreet`(波1と波2は次の波の`Street`、波3は`Result`。波を進めるのはここ)
- 波ごとの背景、ルール、言い直しは`currentFreeWave(run)`で読む。クリアまでの時計は`run.free.clockMs`に積み上げる

| シーン | 画面 |
|---|---|
| Boot | 読み込み。絵を用意して、字を読み込む |
| Title | タイトル。ここで音を鳴らし始める |
| StageSelect | ステージを選ぶ |
| Intro | ステージ前の掛け合い |
| Sort | 仕分け |
| Street | 結果発表(ヒーローが仕分け通りに動く)。モールの波2はタイムセールラッシュも。フリープレイの通りもこのシーン |
| Boss | ボス戦。高層ビルの念力の選択、窓のひび、朝日は`boss/choice.ts`と`boss/sunrise.ts` |
| WaveReview | 波ごとの答え合わせ |
| Floor | 高層ビルの波の間の、階の数字だけの短い場面(波1と2、波2と3の間) |
| Elevator | エレベーターラッシュ(高層ビルの波3の答え合わせのあと、波4の仕分けの前) |
| Ending | 終わりの場面。高層ビルのボスを初めて倒したときだけ、最後の答え合わせと結果画面の間に出す(行き先は`run.ts`の`sceneAfterLastReview`) |
| Result | 結果画面と共有 |
| TitleList | 称号の一覧(結果画面、タイトル、ステージを選ぶ画面から開く) |

ほかのシーンの上に重ねて出すシーンが2つあります。

| シーン | 中身 |
|---|---|
| `UiPause` | 一時停止のメニュー。掛け合い、仕分け、結果発表、ボス戦の上に出す(`src/ui/pause.ts`) |
| `UiWipe` | 画面の切り替えのワイプ(`src/ui/transition.ts`の`goto`) |

画面の担当は、数字や文章を自分で書かずに`src/logic/`から読みます。

- 数字:`rules.ts`(ステージごとの違いは`stages.ts`)
- 文章:`content.ts`(ステージ2の文は`garageContent.ts`、ステージ3の文は`mallContent.ts`、ステージ4の文は`towerContent.ts`)
- 人の並び:`stage.ts`(ステージ2は`garage.ts`、ステージ3は`mall.ts`、ステージ4は`tower.ts`)。ワルの目印の出し分けは`tells.ts`、服の色ちがいは`colorVariants.ts`
- ステージ2のギャングの組:`gang.ts`。ステージ3のUFO:`ufo.ts`。ステージ4の念力(時間の流れ、並べ方、落ちた所で何が壊れるか):`psychic.ts`。UFOと念力の段階の進め方と順番待ちは`timedCall.ts`で共通
- ボス戦:`boss.ts`。ステージ4の念力の選択(3秒、待てと行け、押さなかった分の数え方):`bossChoice.ts`
- 称号:`titles.ts`(全部集めるのは`collectTitles`、大きく出す1つは`decideTitle`)
- 待てと行けを止めて教える場面:`lesson.ts`
- 数え方:`stats.ts`
- フリープレイの数字と並び:`freeplay.ts`、文:`freeContent.ts`と`freeNames.ts`
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
| `&stage=garage` | ステージ2で始める(鍵が開いていなくてもよい)。`&stage=mall`でステージ3、`&stage=tower`でステージ4(高層ビル)。書かなければ路地裏 |
| `&wave=2` | 始める波(1〜3、高層ビルは1〜4)。書かなければ1、`Boss`と`Result`のときは最後の波、`Elevator`のときはラッシュの次の波(高層ビルなら4) |
| `&seed=123` | 人の並びを決める種。同じ種なら毎回同じ並びになる。書かなければ12345 |
| `&sorts=truth` | 飛ばした波の仕分けの決め方。`truth`全部正しく、`random`でたらめ(書かないときはこれ)、`bad`全員ワル、`civ`全員市民 |
| `&attack=punch` | 結果発表でヒーローがワルを殴るときの技を決める。`charge`、`punch`、`stomp`、`uppercut`、`flykick`、`throw`、`hip`、`special`。ボスが正体を現す場面では`throw`を書いても投げず、ふつうに選ぶ |
| `&free=1` | フリープレイで始める(`Street`か`Result`)。`Street`では`&wave`で始める波を決められる(時計は0から)。ゆっくりモードは一時停止のメニューの設定のまま |
| `&unlocked=alley,garage` | フリープレイで開いているステージ(出てくる人と背景)。書かなければ路地裏だけ |
| `&threat=8` | フリープレイで、モヒカンが逃げるまでの秒数をのばす(行けのマークが2つ出る場面を作るため) |
| `&cards=4` | ステージを選ぶ画面(`?scene=StageSelect`)で、カードを4枚に増やして並べ方とずらし方を見る(足りない分は前のカードをくり返す) |
| `&justunlocked=mall` | ステージを選ぶ画面で、そのステージが開いたばかりの演出をする(自動でずらしてから鍵がこわれる。ページを開いて最初の1回だけ) |

場面の名前は大文字と小文字を区別しません(`?scene=street`でもよい)。

例:

- `http://localhost:5173/?scene=Street&wave=3&sorts=civ`(ボスを市民にした波3の結果発表)
- `http://localhost:5173/?scene=Boss&stage=garage`(女ボスとのボス戦)
- `http://localhost:5173/?scene=WaveReview&wave=2&sorts=random`(波2の答え合わせ)
- `http://localhost:5173/?scene=Street&stage=mall&wave=1&sorts=civ`(宇宙人を見逃して、UFOが来るモールの結果発表)
- `http://localhost:5173/?scene=Street&stage=mall&wave=2&sorts=truth`(波2の結果発表のあとにタイムセールラッシュ)
- `http://localhost:5173/?scene=Boss&stage=mall`(宇宙人の親玉とのボス戦。体力が半分を切ると母艦に乗りこむ)
- `http://localhost:5173/?scene=Elevator&stage=tower`(エレベーターラッシュ。波1〜3の仕分けを埋めて、波4の前から)
- `http://localhost:5173/?scene=Street&free=1&wave=3&unlocked=alley,garage,mall`(フリープレイの波3から。`unlocked`は開いているステージで、書かなければ路地裏だけ)

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
| `?scene=Result&sample=top&stage=tower` | 最上階のヒーロー(高層ビルのボスを初めて倒した。記録はまだ倒していないことにする) |

- `&stage=garage`、`&stage=mall`、`&stage=tower`をつけて`sample`を書かないときは、そのステージのふつうの見本になる(モールは買い物客が1人さらわれた数字、高層ビルは念力で運ばれた物が市民に落ちた数字)
- 路地裏の見本に`&unlock=1`を足すと、「地下駐車場が開いた」の知らせも出ます。地下駐車場の見本に足すと「モールが開いた」、モールの見本に足すと「高層ビルが開いた」です(例:`?scene=Result&sample=roundup&stage=garage&unlock=1`)
- 見本は本当の記録を書きかえません(その場かぎりの記録に書く)。前の記録を入れてあるので、NEWの印が出る。`&new=0`で前の記録を入れない
- `?scene=Result&free=1`でフリープレイの結果画面の見本(`&sample=sitter`、`interp`、`letitbe`でフリープレイだけの3つの称号。`&more=1`で「ステージを進めると、出てくる人が増えるよ」も出る)

開発用のサーバーでは、ブラウザの開発ツールからゲームの中身をさわれます(`tools/`のスクリプトが使う)。

| 名前 | 中身 |
|---|---|
| `window.__game` | ゲーム全体 |
| `window.__sh` | タイトル、ステージを選ぶ画面、掛け合い、仕分け、階の数字の場面(`Floor`)、終わりの場面(`Ending`)の中身 |
| `window.streetDev` | 結果発表のシーン(フリープレイの通りの中身は`streetDev.free`) |
| `window.bossScene` | ボス戦のシーン(途中の場面から始めたときだけ) |
| `window.liftDev` | エレベーターラッシュのシーン(`src/scenes/Elevator.ts`) |
| `window.reviewDev` | 答え合わせ |
| `window.resultDev` | 結果画面 |
| `window.titleListDev` | 称号の一覧 |
| `window.pauseDev` | 一時停止のメニューのボタン |

そのスマホの中に覚えるもの(localStorage):

| キー | 中身 |
|---|---|
| `stupidhero.settings.v1` | 設定 |
| `stupidhero.records.v2` | 記録(称号、掛け合いを見たか`introSeen`、ラッシュを見たか`rushSeen`、結果発表で待てと行けを止めて教えたか`lessonSeen`(`['stop', 'go']`)も。フリープレイの記録`free`、フリープレイの掛け合いを見たか`freeIntroSeen`、「ステージを進めると、出てくる人が増えるよ」を出したか`freeMoreHintShown`、最後に遊んだステージ`lastStage`、称号の一覧で見た称号`listSeen`、高層ビルの終わりの場面を見たか`endingSeen`、時間切れでゆっくりモードのことを教えたか`slowHintSeen`(一時停止のメニューでゆっくりモードをオンにしたときも残す)も) |
| `stupidHero.muted` | 音を切ったか |

初めての人の流れ(ステージ選びをとばす、掛け合いを出す、結果発表で待てと行けを止めて教える)を見直すときは、記録を消してから開きます(古い`stupidhero.records.v1`が残っていれば、それも消す。あると読みこんで遊んだことになる)。

## 開発用のページ

開発用のサーバーで開きます。

| ページ | 中身 |
|---|---|
| `/dev/art.html` | 絵の一覧。`?keys=hero,fx_aura`で絞りこみ、`?scale=3`で拡大。ゲームと同じく`public/art/`のPNGを読み、PNGで差し替わった絵はキーの横に「PNG」と出す。いちばん下に、フリープレイの人に波3の小物を重ねた見本(`itemAnchor`の場所。右向きと左向き)を並べる(`?keys=`で`fp_`のキーを選んだときも出る) |
| `/dev/audio.html` | 曲と効果音を1つずつ鳴らす。「数字で確かめる」で音の大きさを表にする |
| `/dev/ui.html` | UIの部品。`?page=sort`、`result`、`parts`、`swipe`、`text` |
| `/dev/text.html` | ゲームに出る文を並べる。`?set=check`で禁則のまちがいだけを並べる |

## テスト

```sh
npm test            # vitest。src/の*.test.tsを全部動かす
npm run typecheck   # tsc
```

pushするたびに、GitHub Actions(`.github/workflows/test.yml`)で同じ2つが動きます。

`src/art/artRules.test.ts`は、コードで描いた絵の全部(ヒーロー、ステージ1〜4、フリープレイ)が`docs/ART_SPEC.md`の色の決まりを守っているかを見るテストです。1枚15色まで、8段階の色だけ、明るい緑なし、赤紫はステージ2の人の小物だけ、黄緑の3色はステージ3だけ(フリープレイの宇宙人はよい)、超能力の紫はステージ4のもれと念力と親玉の光(と、仕分けの画面の紛らわしい市民の理由)だけ、背景は奥の絵1枚と組む壁と床で45色まで、奥の背景に透明なし、を確かめます。ステージ4の絵は`src/art/world4/world4.test.ts`でも見ます(人の7行、照明と小物の紫、紫のセロハンの照明、手品師のつえの先)。絵を描き足したり直したりしたら、これが通るかを見ます。フリープレイの絵は、`src/art/free/free.test.ts`でも見ます(小物と札の色、紙袋の大きさ、小物を付ける場所が絵と合うか、小物でワルの目印が隠れないか、ヒーローの光の形)。服の色ちがいの表は`src/art/variants.test.ts`で見ます(手がかりの色を使わないか、服の色のドットだけが変わるか。くわしくは`docs/ART_SPEC.md`の「服の色ちがい」)。

`src/logic/published.test.ts`は、公開した版とステージ1の中身が変わっていないかを比べるテストです。答えは`src/logic/fixtures/`のJSONに入っています。このJSONは作り直さないでください。ステージ1の中身をわざと変えたときだけ、理由を書いて作り直します。仕分けの見直しで、波の時間、プロフィールの一文、オペレーターの一言はわざと変えたので、JSONは作り直さずに、それらを比べる項目から外してあります。

## ブラウザで確かめるスクリプト(tools/)

Playwrightで、スマホの大きさのブラウザを開いて指で操作します。CIでは動かさないので、手元で動かします。

動かし方:

1. 先に開発用のサーバーを立てる(`npm run dev`。ふつうは`http://localhost:5173/`で開く)
2. 別の窓でスクリプトを動かす(例:`node tools/textcheck.mjs`、`node tools/playthrough.mjs - - 5 mall truth`)

どのスクリプトも、ふつうは`http://localhost:5173/`のサーバーを開き、撮った画像を`shots/`に置きます(`shots/`はgitに入れません)。ほかのポートやほかの場所のサーバーを使うときは、環境変数`DEV_URL`に入れるか、引数で渡します(数字だけならポートとして読む)。画像の置き場所は、環境変数`SHOTS_DIR`か引数で変えられます。引数を省くかわりに`-`と書くと、ふつうの値になります。

使い方の引数は、各ファイルの先頭にくわしく書いてあります。NGが1つでもあると、終了コード1で終わります。

結果発表で待てと行けを止めて教える場面は、記録が空の端末(スクリプトが開くブラウザはいつも空)で、市民に待てのマークが出たときと、悪さのワルに行けのマークが出たときに出ます。止めている間は、教えているボタンを押すまで動きません。そのため、スクリプトは次のどちらかをします。`lib.mjs`に部品があります。

- 止めて教える場面をとばす:`skipLessons(page)`を`page.goto`の前に呼ぶ(記録に`lessonSeen`を足す)。`street_tap.mjs`は、止めて教える場面を試すところのほかはこうする
- 出たら押す:`lessonButton(page)`で押すボタンを調べて押す。`playthrough.mjs`はこうする(撮ってから押す)

`timeshots.mjs`は、オプションに`lesson`を書かなければとばします。`streetDev.stopHandler()`や`goHandler()`をじかに呼んでも、止めている場面は終わります(ボタンを押したのと同じ)。フリープレイ(`free_play.mjs`)とボス戦(`boss_test.mjs`)では出ません。

ブラウザの場所は`tools/lib.mjs`の`CHROME`で決まります。ふだんはClaude Codeのクラウドの環境に入っているChromiumを使います。ほかの場所で動かすときは、環境変数`CHROME`にブラウザの場所を入れて動かします(例:`CHROME=/usr/bin/chromium node tools/uitest.mjs`)。どちらもなければ、playwright-coreが自分でブラウザを探します。

`playwright-core`は1.56に止めています。クラウドの環境に入っているChromiumの版(1194)に合わせているためです。上げるときは、そのブラウザも合わせて変えます。

| スクリプト | ステージ | すること |
|---|---|---|
| `playthrough.mjs` | `alley`、`garage`、`mall`、`tower` | タイトルから結果画面まで自動で通しで遊び、エラーが出ないか見る。結果発表で待てと行けを止めて教える場面が出たら、撮ってから教えているボタンを押す(同じ種類が2回出たらNG)。場面ごとに画面を撮る。答え合わせでは次へを押して進み、全部の波の答え合わせを通ったかも見る。高層ビルでは、ステージを選ぶ画面でNEW!のカードが見えているか、階の数字(18Fと35F)、エレベーターラッシュ(市民にだけ待て)、念力の選択(待てと行け)、終わりの場面も見る。仕分けの決め方(`random`、`truth`、宇宙人を見逃してUFOを呼ぶ`ufo`、ボスを市民にする`bossciv`。`ufo+bossciv`のようにつなげられる)を選べる。地下駐車場、モール、高層ビルは、前のステージを倒した記録を入れてからステージを選ぶ画面で選ぶ。結果画面の共有カードと、いちばんひどい場面の写真も書き出す |
| `sort_drive.mjs` | URLで決める | 手順を並べて指で動かし、撮ったり式を調べたりする |
| `street_tap.mjs` | `alley`、`garage`、`mall`、`tower` | 結果発表で、中断と「つづける」(一時停止のメニュー)、早送り、待て、行けが効くか試す。地下駐車場は仲間が集まったところとワゴンに乗ったところの行け、モールはUFOを行けで落とす、押さずにさらわれる、タイムセールラッシュ(市民にだけ待て。エスカレーターが壊れないまま始まるか、長さが約16秒か)、高層ビルは念力で運ぶ物を早く行けで落とす(ヴィランを倒す)、ソファの上で行けを押す(何も壊れない)、押さずに市民に落ちるところを試す。`alley`では最後に、記録が空の端末で待てと行けを止めて教える場面を試す(止まっている間は時計も動きも進まない、ほかのボタンやタップでは進まない、8秒で押す所を言う一言に替わる、押すとふつうに効いて記録に残る、読みこみ直すと2回目は出ない)。ほかのところは止めて教える場面をとばす |
| `lift_test.mjs` | `tower` | エレベーターラッシュを画面の高さ384と468で、市民にだけ待て、何も押さない、全員に待ての3通りで遊ぶ。数、ほかの数字が変わらないか、長さが約17秒か、定員オーバーと見逃したヴィランの紫の光、波4の`Sort`へ続くかを見る。波3の答え合わせから`Elevator`へ来るか、2回目の説明が1つになるか、一時停止と画面を離れたときに止まるかも見る |
| `boss_test.mjs` | `alley`、`garage`、`mall`、`tower`(5つ目の引数。引数はサーバー、出力フォルダ、倍率、mode、ステージ、画面の高さ) | ボス戦を連打で試す。modeは`rush`(ふつう。書かなければこれ)、`idle`(何も押さない)、`pause`(一時停止)、`civ`(ボスを市民に仕分けたあと)、`nochoice`(高層ビルだけ。念力の選択で何も押さない)。始まりのセリフの間に行けのボタンが押せる見た目で「行けを連打!」と出ていて、押しても連打に数えず、連打が始まると「行け!」に戻るかも見る。放っておいても15秒で終わるか、一時停止で時計が止まるか、倒したあと答え合わせ(WaveReview)へ行くかも見る。地下駐車場とモールは、体力が半分を切ると車(母艦)に乗りこむところと、手が止まったときの被害額(乗る前¥50万、車¥100万、母艦¥150万が1秒ごと)、モールは倒すと噴水の¥150万が足されるかも見る。高層ビルは、念力の選択で時計が止まるか、待てと行けを押すと両方助かるか、押さないと客が落ちてシャンデリアの¥3,000万が足されるか(modeが`nochoice`)、戻ってから倒れるまで1.5秒より早くないか、倒すとシャンパンタワーの¥1,000万が足されるかも見る。端末が重くて確かめたい瞬間に間に合わなかったものは、NGではなくSKIPと出す(ほかのものを止めて動かし直す) |
| `free_play.mjs` | 開いているステージを5つ目の引数で渡す(書かなければ3つとも。引数はサーバー、出力フォルダ、押し方、種、開いているステージ) | フリープレイの3つの波を通しで遊び、落ちないか、結果画面まで行くか、数が合うかを見る。場面ごとに画面を撮る。押し方を選べる(書かなければ`both`)。`good`は市民への待てとワルへの行けのマークが出たらすぐ押し、素通りしかけたワルをどれも悪さの前に倒すかを見る。`civgo`は`good`に加えて素通りしかけた市民に1回だけ行けを押し、市民のけがと3秒の足し分に数えるかを見る。`none`は何も押さない。`late`は待てをギリギリに押してワルにも1回待てを押し、行けは悪さのマークだけに押す。`two`は行けのマークが2つ出る場面と光の拳を試す。`early`は行けを悪さの前ぶれ(モヒカンが走り出す、ギャングの口笛、UFOへの合図)で押し、覚えた行けがマークが出た瞬間に全部効いて空押しが0かを見る。`gang1`はギャングの組の1人目にだけ行けを押し、1人で口笛を吹いた2人目はそのマークで押す。`gang1x`は2人目にも押さず、組を「行けで決めた」に数えないかを見る。`wavego`は素通りしかけたワルへの行けを、ヒーローが手を振り始めてから押す。`both`は`good`と`none`、`all`は9つとも。環境変数`SLOW=1`でゆっくりモード、`REDUCE=1`で「光と揺れを弱くする」をオンにして始める |
| `result_sharetest.mjs` | `alley`、`garage`、`mall`、`tower`、`free` | 結果画面の共有ともう一回を試す(共有メニューがあるとき、ないとき、キャンセルされたとき、失敗したとき、パソコン)。共有の文が見出し、#StupidHero、URLの3行か、「画像を保存」でPNGを保存できるかも見る。`free`はフリープレイの結果画面で、もう一回で掛け合いを出さずに`Street`へ行くかも見る |
| `result_shot.mjs` | URLの後ろに`stage=`を書く | 結果画面と共有カードの画像を書き出す |
| `result_og.mjs` | | 共有用の画像`public/og.png`をゲームの絵で作り直す |
| `textcheck.mjs` | | ゲームの全部の文を折り返して、禁則のまちがいがないか見る |
| `audioCheck.mjs` | | 曲と効果音の音の大きさを測り、音が割れていないか、無音でないかを見る。フリープレイの曲(`free1`〜`free3`)の切りかえと、決めつけと空押しの音も見る。高層ビルの曲(`street4`、`boss4`、`lift4`)は、平均の大きさがほかの曲とそろっているか、`lift4`の速くなっていく前奏が17〜20秒かも見る |
| `uitest.mjs` | | UIの部品(`/dev/ui.html`)をタッチで試す |
| `stageselect_scroll.mjs` | | ステージを選ぶ画面を高さ384と468で開いて撮り、4枚のカードがあるか、NEW!のカードが見えているか、指で上下にずらせるか、はじくとすべって端で止まるか、8ドットまでの動きならカードを選ぶか、開いたばかりの高層ビルまで自動でずれるかを見る |
| `timeshots.mjs` | URLで決める | 決めた時間ごとに画面を撮る。`w=`で幅、`full`でページ全体を撮る(1枚だけ撮るときもこれを使う)。結果発表で待てと行けを止めて教える場面は、`lesson`を書かなければとばす |
| `dashboard.mjs` | | 開発のダッシュボードを作る(`npm run dashboard`。`--quick`でテストと型の確かめをとばす。下の「開発のダッシュボード」) |
| `artsheet.mjs` | | コードで描いた絵のシートと背景を、ブラウザもサーバーもなしでPNGに書き出す(例:`node tools/artsheet.mjs hero 4`で`shots/art/hero.png`。引数はキー、倍率、出力フォルダ。`tw_`のように表にない頭を書くと、それで始まるキーを全部)。コマの境目に線を入れる。絵を描き直すときに見比べる用。`node tools/artsheet.mjs variants 3`で、服の色ちがいの見本を見た目ごとに書き出す(`shots/art/variants_<見た目>.png`。`variants:hoodie,guard`で見た目を絞る) |
| `icons.mjs` | | ホーム画面のアイコン(`public/icon-192.png`、`public/icon-512.png`、`public/apple-touch-icon.png`と、Androidが丸や角丸に切りぬく用の`public/icon-maskable-192.png`、`public/icon-maskable-512.png`。maskableは頭をまん中の丸に入れる)を、ヒーローの顔のカットインの絵から、ブラウザもサーバーもなしで書き出す。顔の絵を描き直したら動かす(`node tools/icons.mjs`) |
| `lib.mjs` | | 上のスクリプトで共通に使う部品 |
| `png.mjs` | | PNGを書き出す部品(`artsheet.mjs`と`icons.mjs`が使う) |

引数の順はスクリプトによってちがいます。多くはサーバーが先で出力フォルダが次ですが、`result_sharetest.mjs`、`result_shot.mjs`、`uitest.mjs`は出力フォルダが先、`result_og.mjs`は出力PNGが先です。迷ったら各ファイルの先頭を見ます。

## 開発のダッシュボード

開発の様子を1枚のページにまとめます。開発用のサーバーはいりません。

```sh
npm run dashboard              # テストと型の確かめも動かす
npm run dashboard -- --quick   # テストと型の確かめをとばす
```

Node 22.18以上なら`node tools/dashboard.mjs`でも動きます。それより前だと`src/`の`.ts`を読めずに止まるので、`npm run dashboard`を使います。

`dashboard/index.html`に書き出します(gitに入れません)。出るのは、公開していない変更の数(`pages.yml`の公開の版から数える)、テストと型の確かめの結果、コミットとClaudeのセッションの数、PNGにした絵の数、やることと質問、最近のコミットです。

やることと質問は`docs/BOARD.md`と`docs/BOARD_ARCHIVE.md`の表から読み、両方を合わせて数えます。作業をする人(AIも)は、作業を始めるときと終わるときに`docs/BOARD.md`を直し、人に決めてほしいことは「質問」に足します。作業の始めに読むのは`docs/BOARD.md`だけです。読む量が増えないように、`done`の行はやることと質問のそれぞれで新しい5行だけ残し、それより古い行は`docs/BOARD_ARCHIVE.md`の同じ表へIDを変えずに移します。2つのファイルの表の形は同じです。Claude Codeのセッションでは、終わるときにダッシュボードを作り直し、決まったURLのArtifactに公開し直します。人はそれをスマホで見ます。手順とURLは`CLAUDE.md`にあります。

## 文章を書くときの決まり

`src/logic/content.ts`の先頭に書いてある決まりを守ります。

- 1行は全角12文字まで、1つのセリフは2行まで(改行は`\n`)
- 半角スペースとエムダッシュは使わない
- 2人の名前はまだ決まっていないので、文の中で名前を呼ばない
- ヒーローは元気で大げさで自信満々、オペレーターはため口でツッコむ幼なじみ
- 小さい子にも読めるように、むずかしい漢字の言葉はやさしい言葉にする(「貫禄」は「オーラ」、「給仕」は「料理を運ぶ」、「新調」は「今日のために買った」など)

セリフ、プロフィール、一言、答え合わせの決め手では、同じ言葉を次の書き方にそろえます(画面の見出しやボタンの言葉は対象にしない)。

| 言葉 | この書き方にする | 使わない書き方 |
|---|---|---|
| あやしい | あやしい | 怪しい |
| ひとめ | 一目 | ひと目 |
| ぶっとばす | ぶっ飛ばす | ぶっとばす |
| おつかれさま | お疲れさま | おつかれさま |
| てをふる | 手を振る | 手をふる(「手をふく」は拭くなので、ひらがなのまま) |
| さがす | 探す | さがす |
| 人数を数えるとき | 1人 | 一人 |
| 1人きりのとき | ひとり | 一人 |
| まちがえる | 間違える、間違い | まちがえる |
| はで | 派手 | ハデ |
| ぱんぱん | パンパン | ぱんぱん |
| ねむそう | 眠そう | ねむそう |
| まわり | 周り | まわり |
| 高層ビルの照明 | 明かり | 照明(絵の名前やコードのコメントでは照明のままでよい) |
| 高層ビルの敵 | ヴィラン | 超能力者 |
| 仕分けの印 | ハンコ | 札(札はフリープレイのルールの札のこと) |
| フリープレイの行けで決めたこと | 倒す | 止める(止めるは待てで使う) |

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

## 煙と光の粒を足す、変える

煙、火の粉、UFOの光の粒は、コードで点を打って描いています(`src/ui/particles.ts`)。絵の決まり(色、大きさ、重なりの順)は`docs/ART_SPEC.md`の「コードで描く粒(煙と光の粒)」にあります。

| 部品 | すること | 使っている所 |
|---|---|---|
| `CurlSmoke` | 煙。渦を巻く流れに乗せて上らせる。出たばかりはまっすぐ上り、古くなるほどうねる | ボス戦のボンネットと燃える車(母艦)、結果発表の壊れたワゴンと落ちたUFO |
| `HermiteSparks` | 光の粒。出る所から、横へふくらんでから行き先へ吸いこまれる | UFOの吸い上げる光 |

動きの計算(エルミート曲線、なめらかな乱数、渦の流れ)は`src/ui/flow.ts`にまとめてあります。Phaserを使わないので、`src/ui/flow.test.ts`で確かめています。

```ts
// 車について行く煙。3秒たったら出すのをやめる(出ている粒は消えるまで流れて、全部消えたら自分で片づく)
new CurlSmoke(this, {
  x: () => car.frontX + 6, y: () => car.smokeY, depth: DEPTH_OF.car - 0.1,
  colors: SMOKE_LIGHT, rate: 35, wind: -16
}).stopAfter(3000);
```

- `x`と`y`は、数か、数を返す関数。関数にすると毎コマ読むので、動くものについて行く
- 濃さは`rate`(1秒に出す粒の数)、高さは`life`(消えるまでの秒)と`rise`(上る速さ)、横の流れは`wind`で変える
- 煙を出すものより奥(`depth`を小さく)に置くと、後ろから立ちのぼって見える
- シーンの時計の速さに合わせて動くので、ヒットストップの間は止まり、早送りの間は速くなる。一時停止の間は止まる。シーンが終わると片づく
- 見た目だけの乱数なので`Math.random`を使う。ゲームの中身の乱数(`rng`)は使わない(遊ぶたびの並びが変わってしまうため)

ブラウザで確かめるときは、開発ツールから場面を早く進められます。

| 見たいもの | 開くURLと、開発ツールですること |
|---|---|
| ボンネットの煙 | `?scene=Boss&stage=garage`(母艦は`stage=mall`)。連打が始まったら`bossScene.boardCar()`で車に乗せ、`Object.defineProperty(bossScene.fight, 'hpRatio', { get: () => 0.2 })`で体力を3割より少なく見せる |
| 燃える車、噴水に落ちた母艦 | 上のあとに`bossScene.onDefeated()`。煙が見えるのは、次の画面に変わるまでの2秒ほど |
| UFOの光の粒と、落ちたUFOの煙 | `?scene=Street&stage=mall&wave=1&sorts=civ&seed=3`。UFOが光で吸い上げ始めたら`streetDev.goHandler()`で行けを押す |

Playwrightで撮るときは、コンテナの中などで1秒に数コマしか動かないと、粒が少なく、動きもゆっくりに見えます(1コマで進める時間は0.05秒までにしているため)。濃さや動きは、スマホの実機でも見ます。

## 公開する

公開は`.github/workflows/pages.yml`で、GitHub Pagesに出します。作りかけが出ないように、手で動かしたときだけ公開します。

1. GitHubのActionsの画面で「Pages」を選び、「Run workflow」を押す
2. 「公開する版」に、公開したいコミット(かタグかブランチ)を入れる。コミットは40文字の完全な番号で入れる(短い番号だとコードを取り出すところで失敗する)。最初から入っているのは、いま公開している版
3. テスト(`npm test`)と組み立て(`npm run build`。型の確かめもする)が通ると公開される

公開したら、`pages.yml`の`default`を公開した版のコミットに書きかえてコミットします(次に動かすときの既定になり、いまどの版を公開しているかも分かる)。いまどの版を公開しているかと、その版に何が入っているかは、`pages.yml`の`default`と、その上のコメントに書きます(ダッシュボードもこのコメントを読んで出す)。

新しいリポジトリで初めて動かすときだけ、GitHubの Settings → Pages → Source を「GitHub Actions」にしておきます。

共有されたときに出る画像`public/og.png`は、絵を変えたら`tools/result_og.mjs`で作り直します。

ホーム画面に追加したときの名前とアイコンは`public/manifest.webmanifest`に書いてあります(iPhoneは`index.html`の`apple-touch-icon`を使う)。アイコンは`tools/icons.mjs`で作ります。ページの中の場所はどれも相対の書き方なので、GitHub Pagesの`/StupidHero/`の下でもそのまま使えます(`vite.config.ts`の`base`が`./`)。オフラインで遊ぶための仕組み(サービスワーカー)はまだ入れていません。
