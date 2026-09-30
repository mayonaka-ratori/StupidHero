// 見分ける手がかりの出し分け(tell)。同じ見た目でも、人ごとに手がかりの絵を変える(何度遊んでも「この見た目でこの小物ならワル」と覚えきれないように)。
// 決まりは docs/SPEC.md「同じ見た目の市民とワル」、docs/STAGE2.md「見た目」、docs/STAGE3.md「見た目」。
//
// - ステージ1(パーカー、スーツ、買い物袋):ワルの危ない物か盗んだ物が3つずつ。市民にも、同じあたりに似た形の、害のない物が3つずつある
// - ステージ2(4つの見た目):おそろいの色をつける小物の形が2〜3つ。市民とギャングで同じ形の中から選ぶ(形では見分けられない。色を読む)
// - ステージ3(4つの見た目):宇宙人のくずれの出方が2つずつ。市民にはない
//
// どれにするかは、ステージの種から作った別の乱数(tellRngFor)で決める。ステージの乱数を引く回数が変わらないので、
// 誰がどの順で出るか、名前、年齢などは、手がかりを足す前と同じ(公開版と比べるテスト published.test.ts)。
// 1つ目の手がかりは元の絵のまま(絵のキーは `${look}_${truth}`)。2つ目からは絵のキーの後ろに `_${suffix}` がつく。
//
// 文との合わせ方:文(プロフィール、一言、決めつけ)に、ある手がかりだけの言葉(words)が入っていたら、
// その文はその手がかりの人にしか出さない(「黄色い物がちらっと見えた」はナイフの柄かバナナの人だけ)。

import { createRng, type Rng } from './rng';
import type { Look, Truth } from './types';

/** 手がかりの出し分け1つ */
export interface TellDef {
  /** id(Person.tell に入る)。例 'knife' */
  id: string;
  /** 絵のキーの後ろにつける名前。null なら元の絵のまま */
  suffix: string | null;
  /** 答え合わせの決め手(ステージ1と3。全角14文字まで)。ステージ2は小物の名前と色から作るので書かない */
  reason?: string;
  /** ステージ2の小物の名前。市民とギャングで同じならどちらも同じ文字 */
  item?: { civ: string; bad: string };
  /** つながりの文で小物を指す言葉(ステージ2。書かなければ item の名前。整備士の首の布は、市民とギャングで名前が違うのでまとめて呼ぶ) */
  noun?: string;
  /** この手がかりだけの言葉。文にこの言葉があれば、この手がかりの人にしか出さない */
  words?: readonly string[];
}

type TellTable = Partial<Record<Look, Partial<Record<'civ' | 'bad', readonly TellDef[]>>>>;

const t = (id: string, suffix: string | null, reason: string, words: readonly string[] = []): TellDef => ({ id, suffix, reason, words });
/** ステージ2の小物(市民とギャングで同じ形) */
const acc = (id: string, suffix: string | null, civ: string, bad = civ, words: readonly string[] = [civ], noun?: string): TellDef =>
  ({ id, suffix, item: { civ, bad }, words, noun });

/** ステージ2の見た目ごとの小物の形(市民とギャングで同じ一覧) */
const GARAGE_TELLS = {
  guard: [
    acc('armband', null, '腕章'),
    acc('epaulette', 'epaulette', '肩章')
  ],
  mechanic: [
    // 市民はタオル、ギャングはバンダナ(絵は同じ)。文では「首の布」とまとめて呼ぶ
    acc('neck', null, 'タオル', 'バンダナ', ['タオル', 'バンダナ', '首の布', '首に'], '首の布'),
    acc('hanky', 'hanky', 'ハンカチ')
  ],
  clubber: [
    acc('headband', null, 'ヘアバンド'),
    acc('cap', 'cap', 'キャップ', 'キャップ', ['キャップ', '帽子']),
    acc('phones', 'phones', 'ヘッドホン')
  ],
  officelady: [
    acc('scarf', null, 'スカーフ'),
    acc('ribbon', 'ribbon', 'リボン')
  ]
} as const;

/** 見た目と正体ごとの手がかりの一覧(1つ目が元の絵) */
export const TELLS: TellTable = {
  // ─── ステージ1:ワルは危ない物か盗んだ物。市民は同じあたりに似た形の、害のない物 ───
  hoodie: {
    // 後ろのポケットから出ている物
    bad: [
      t('knife', null, 'ポケットに黄色いナイフの柄', ['黄色']),
      t('knuckles', 'knuckles', 'ポケットにメリケンサック', ['銀色']),
      t('stungun', 'stungun', 'ポケットにスタンガン', ['黒い'])
    ],
    civ: [
      t('wallet', null, 'ポケットの茶色い物は財布', ['茶色']),
      t('banana', 'banana', '黄色い物はおやつのバナナ', ['黄色']),
      t('keys', 'keys', '銀色の物は家のカギだった', ['銀色'])
    ]
  },
  suit: {
    // 脇に抱えているか、手に持っている物
    bad: [
      t('bag', null, '赤い女物のバッグを抱えていた', ['赤い']),
      t('purse', 'purse', 'ピンクのがま口を抱えていた', ['ピンク']),
      t('pearls', 'pearls', '真珠の首飾りをにぎっていた', ['白い'])
    ],
    civ: [
      t('watch', null, '金色は腕時計。会議に遅れそう', ['金色', '時計']),
      t('phone', 'phone', 'スマホで時間を見ていた', ['スマホ', '時計']),
      t('ticket', 'ticket', '白いのは新幹線の切符', ['白い'])
    ]
  },
  shopper: {
    // 袋の口からのぞいている物
    bad: [
      t('wallet', null, '袋に金色の財布。人の物だった', ['金色']),
      t('watch', 'watch', '袋に人の腕時計が入っていた', ['金色', '時計']),
      t('phones', 'phones', '袋に人のスマホが何台も', ['黒い'])
    ],
    civ: [
      t('rice', null, 'のぞいていたのは白い米袋', ['白い']),
      t('leek', 'leek', 'のぞいていたのは長ねぎ', ['緑']),
      t('bread', 'bread', 'のぞいていたのはフランスパン', ['フランスパン'])
    ]
  },
  // ─── ステージ2:おそろいの色をつける小物の形 ───
  guard: { civ: GARAGE_TELLS.guard, bad: GARAGE_TELLS.guard },
  mechanic: { civ: GARAGE_TELLS.mechanic, bad: GARAGE_TELLS.mechanic },
  clubber: { civ: GARAGE_TELLS.clubber, bad: GARAGE_TELLS.clubber },
  officelady: { civ: GARAGE_TELLS.officelady, bad: GARAGE_TELLS.officelady },
  // ─── ステージ3:宇宙人のくずれの出方 ───
  mascot: {
    bad: [
      t('spin', null, '着ぐるみの首が一回転'),
      t('pop', 'pop', '着ぐるみの頭が浮いた')
    ]
  },
  clerk: {
    bad: [
      t('blink', null, 'まばたきが横に閉じた', ['まばたき']),
      t('eye3', 'eye3', 'おでこに目が開いた')
    ]
  },
  dancer: {
    bad: [
      t('stretch', null, '腕がのびて戻った', ['長く']),
      t('arm3', 'arm3', '肩から腕が一本増えた')
    ]
  },
  uncle: {
    bad: [
      t('flicker', null, '体の色がちらついた'),
      t('hatch', 'hatch', 'おなかがぱかっと開いた')
    ]
  }
};

/** その見た目と正体の手がかりの一覧(出し分けのない人は空) */
export function tellsFor(look: Look, truth: Truth): readonly TellDef[] {
  if (truth === 'boss') return [];
  return TELLS[look]?.[truth] ?? [];
}

/** 手がかりの定義(見つからなければ undefined) */
export function tellDef(look: Look, truth: Truth, tell: string | undefined): TellDef | undefined {
  if (!tell) return undefined;
  return tellsFor(look, truth).find((d) => d.id === tell);
}

/** 手がかりに合わせた絵のキー。base は `${look}_${truth}` の元の絵のキー */
export function tellSheetKey(base: string, def: TellDef | undefined): string {
  return def?.suffix ? `${base}_${def.suffix}` : base;
}

/**
 * 文が、その人の手がかりと食いちがわないか。文に、ほかの手がかりだけの言葉が入っていたら false。
 * 手がかりのない人(tell が undefined)や、出し分けのない見た目は、いつも true
 */
export function fitsTell(text: string, look: Look, truth: Truth, tell: string | undefined): boolean {
  if (!tell) return true;
  const defs = tellsFor(look, truth);
  const mine = defs.find((d) => d.id === tell);
  if (!mine) return true;
  const own = mine.words ?? [];
  for (const d of defs) {
    if (d.id === tell) continue;
    for (const w of d.words ?? []) if (!own.includes(w) && text.includes(w)) return false;
  }
  return true;
}

/**
 * 手がかりを選ぶ乱数。ステージの種から作る別の乱数なので、これを引いてもステージの乱数の引き方は変わらない。
 * stageRng はそのステージを作っている乱数(seed だけを使う)
 */
export function tellRngFor(stageRng: Pick<Rng, 'seed'>): Rng {
  return createRng(`tell:${stageRng.seed}`);
}

/** 出し分けのある絵の一覧(元の絵のキー → 足した絵のキー)。絵の担当の確かめ(テスト)に使う */
export function tellSheetKeys(): { base: string; key: string; look: Look; truth: 'civ' | 'bad'; tell: string }[] {
  const out: { base: string; key: string; look: Look; truth: 'civ' | 'bad'; tell: string }[] = [];
  for (const [look, byTruth] of Object.entries(TELLS) as [Look, TellTable[Look]][]) {
    for (const truth of ['civ', 'bad'] as const) {
      for (const d of byTruth?.[truth] ?? []) {
        if (!d.suffix) continue;
        const base = `${look}_${truth}`;
        out.push({ base, key: tellSheetKey(base, d), look, truth, tell: d.id });
      }
    }
  }
  return out;
}

/** 手がかりの絵のキーから、元の絵のキーを取り出す(出し分けのない絵はそのまま) */
export function baseSheetKey(key: string): string {
  const k = key.split('#')[0];
  return tellSheetKeys().find((x) => x.key === k)?.base ?? k;
}
