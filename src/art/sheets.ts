// 絵の並び(スプライトシート)の表。docs/ART_SPEC.md をそのままコードにしたもの。
// 絵を作る側も、絵を使う側も、この表だけを見る。
// アニメーションのキーは `${シートのキー}.${動きの名前}`(例: 'hero.punch')。
// コマ番号は行ごとに左から0始まり。シート全体でのコマ番号は row * cols + i。

export interface AnimDef {
  /** 動きの名前(英数字) */
  name: string;
  /** コマ数 */
  frames: number;
  /** 1秒に何コマ進むか */
  fps: number;
  /** くり返すか */
  loop: boolean;
  /** 攻撃が当たるコマ(1始まり。ART_SPECの「当たり」と同じ数え方) */
  hits?: number[];
  /** 日本語の説明 */
  note: string;
}

export interface SheetDef {
  key: string;
  frameW: number;
  frameH: number;
  /** 1行に並べるコマ数(シートの横幅 = cols * frameW) */
  cols: number;
  rows: AnimDef[];
  /** 置くときの基準。'feet' = 下から4ドット上の真ん中、'bottom' = 下の真ん中、'center' = 真ん中 */
  anchor: 'feet' | 'bottom' | 'center';
}

export interface ImageDef {
  key: string;
  w: number;
  h: number;
  note: string;
}

const a = (name: string, frames: number, fps: number, loop: boolean, note: string, hits?: number[]): AnimDef =>
  ({ name, frames, fps, loop, note, hits });

const HERO: SheetDef = {
  key: 'hero', frameW: 64, frameH: 64, cols: 8, anchor: 'feet',
  rows: [
    a('idle', 4, 6, true, '待機。胸を張って足踏み'),
    a('run', 6, 12, true, '走る。前のめり、マントがなびく'),
    a('charge', 5, 14, false, '光の突撃。ためる1コマ、飛び出す4コマ', [4]),
    a('punch', 6, 15, false, '光のパンチ。右、左と2発', [3, 6]),
    a('stomp', 6, 12, false, '踏みつぶし。しゃがむ、跳ぶ、空中、落ちる、着地、決め', [5]),
    a('special', 8, 12, false, '必殺技。ためて両手を前に突き出す', [6]),
    a('pass', 4, 8, false, '素通り。笑顔で大きく手を振る、ウインク'),
    a('stop', 5, 12, false, '待てで止まる。急ブレーキ → 敬礼'),
    a('oops', 6, 10, false, 'やっちまったー。両手で頭を抱えてのけぞる'),
    a('okay', 4, 10, false, 'まあいいか。ケロッと立ち直ってガッツポーズ'),
    a('win_pose', 2, 4, true, '勝利:決めポーズ'),
    a('win_arms', 2, 4, true, '勝利:腕組みでドヤ顔'),
    a('win_fist', 2, 4, true, '勝利:拳を突き上げる'),
    a('win_shy', 2, 4, true, '勝利:頭をかいて照れ笑い')
  ]
};

const face = (key: string, rows: [string, string][]): SheetDef => ({
  key, frameW: 32, frameH: 32, cols: 2, anchor: 'center',
  rows: rows.map(([name, note]) => a(name, 2, 8, true, `${note}(左:口を閉じる、右:口を開ける)`))
});

const civRows = (): AnimDef[] => [
  a('idle', 2, 4, true, '待機'),
  a('walk', 4, 8, true, '歩く。逃げるときは速く流す'),
  a('sortIdle', 4, 6, true, '仕分けの画面での動き。1.5秒以内でひと回り'),
  a('surprised', 1, 1, false, '驚く'),
  a('knocked', 2, 10, false, '吹っ飛ぶ。のけぞる、倒れる'),
  a('down', 1, 1, false, 'のびている')
];

const person = (key: string, bad: boolean): SheetDef => ({
  key, frameW: 64, frameH: 64, cols: 4, anchor: 'feet',
  rows: bad ? [...civRows(), a('mischief', 4, 8, false, '悪さ', [3])] : civRows()
});

const disguise = (key: string): SheetDef => ({
  key, frameW: 64, frameH: 64, cols: 4, anchor: 'feet', rows: civRows().slice(0, 3)
});

const BOSS: SheetDef = {
  key: 'boss', frameW: 96, frameH: 96, cols: 4, anchor: 'feet',
  rows: [
    a('reveal', 4, 10, false, '正体を現す。煙の中から服の切れはしを飛ばして出てくる'),
    a('idle', 2, 4, true, '待機'),
    a('rampage', 4, 10, true, '暴れる。周りを壊す'),
    a('hit', 2, 15, true, 'ラッシュを受ける'),
    a('defeat', 4, 8, false, 'やられる')
  ]
};

const prop = (key: string, w: number, h: number, anchor: SheetDef['anchor']): SheetDef => ({
  key, frameW: w, frameH: h, cols: 2, anchor, rows: [a('state', 2, 1, false, '0:ふつう、1:壊れた')]
});

/** ふつうと壊れた以外のコマもある物(ワゴン、高級車) */
const propN = (key: string, w: number, h: number, frames: number, note: string): SheetDef => ({
  key, frameW: w, frameH: h, cols: frames, anchor: 'bottom', rows: [a('state', frames, 8, false, note)]
});

const BOSS2: SheetDef = {
  key: 'boss2', frameW: 96, frameH: 96, cols: 4, anchor: 'feet',
  rows: [
    a('reveal', 4, 10, false, '正体を現す。変装を脱ぎすて、毛皮のコートとサングラス'),
    a('idle', 2, 4, true, '待機。腕を組んで見下ろす'),
    a('rampage', 4, 10, true, '暴れる。手下の車をけしかける、物を投げる'),
    a('hit', 2, 15, true, 'ラッシュを受ける'),
    a('defeat', 4, 8, false, 'やられる。目を回して倒れる'),
    a('jump', 4, 10, false, '車に飛び乗る')
  ]
};

const fx = (key: string, w: number, h: number, frames: number, fps: number, loop: boolean, note: string): SheetDef => ({
  key, frameW: w, frameH: h, cols: frames, anchor: 'center', rows: [a('play', frames, fps, loop, note)]
});

export const SHEETS: SheetDef[] = [
  HERO,
  face('face_hero', [['smug', 'ドヤ顔'], ['oops', 'やっちまった(汗)'], ['smile', '笑顔']]),
  face('face_operator', [['normal', 'ふつう'], ['panic', 'あせり(汗)'], ['deadpan', 'あきれ(ツッコミ)'], ['hype', 'ノリノリ']]),
  person('hoodie_civ', false), person('hoodie_bad', true),
  person('suit_civ', false), person('suit_bad', true),
  person('shopper_civ', false), person('shopper_bad', true),
  person('villain_mohawk', true),
  person('granny_civ', false),
  disguise('boss_disguise_suit'), disguise('boss_disguise_granny'), disguise('boss_disguise_shopper'),
  BOSS,
  prop('prop_trash', 32, 32, 'bottom'),
  prop('prop_window', 24, 32, 'center'),
  prop('prop_sign', 32, 24, 'center'),
  prop('prop_vending', 32, 64, 'bottom'),
  prop('prop_car', 128, 56, 'bottom'),
  // ─── ステージ2(docs/STAGE2.md)───
  // 小物(腕章、タオル、バンダナ、ヘアバンド、スカーフ)は KEY_ACCESSORY の色で描き、ゲームの中で人ごとの色に塗り替える
  person('guard_civ', false), person('guard_bad', true),
  person('mechanic_civ', false), person('mechanic_bad', true),
  person('clubber_civ', false), person('clubber_bad', true),
  person('officelady_civ', false), person('officelady_bad', true),
  disguise('boss2_disguise_guard'), disguise('boss2_disguise_mechanic'), disguise('boss2_disguise_officelady'),
  BOSS2,
  propN('prop_van', 128, 64, 4, '0:止まっている、1〜2:走る、3:壊れた'),
  propN('prop_bosscar', 128, 56, 4, '0:止まっている、1〜2:エンジンをふかして揺れる、3:壊れた'),
  prop('prop_pillar', 32, 96, 'bottom'),
  prop('prop_barrier', 64, 32, 'bottom'),
  prop('prop_cone', 16, 16, 'bottom'),
  prop('prop_extinguisher', 16, 24, 'center'),
  fx('fx_hit', 32, 32, 4, 16, false, '殴ったときの火花'),
  fx('fx_hit_big', 48, 48, 4, 16, false, 'ボス戦の大きな火花'),
  fx('fx_dust', 32, 32, 4, 12, false, '砂ぼこり'),
  fx('fx_stars', 16, 16, 4, 8, true, '目を回した星'),
  fx('fx_debris', 16, 16, 4, 12, false, '破片'),
  fx('fx_mark_stop', 16, 16, 2, 6, true, '待ての合図の「!」(黄色)'),
  fx('fx_mark_go', 16, 16, 2, 6, true, '行けの合図の「!」(赤)'),
  fx('fx_shadow', 32, 8, 1, 1, false, '足元の影'),
  fx('fx_rubble', 48, 24, 1, 1, false, '勝利ポーズのがれき'),
  fx('fx_aura', 64, 64, 4, 12, true, '体を包むオーラ'),
  fx('fx_trail', 48, 32, 4, 16, true, '光の尾'),
  fx('fx_punch', 32, 24, 4, 16, true, '飛んでいく光の拳'),
  fx('fx_shockwave', 96, 32, 4, 12, false, '着地の衝撃波'),
  fx('fx_beam', 32, 48, 4, 16, true, '必殺技の光線。横につなげる'),
  fx('fx_beam_head', 48, 48, 4, 16, true, '光線の先'),
  fx('fx_sparkle', 16, 16, 4, 12, false, 'キラキラ'),
  fx('fx_brake', 32, 16, 4, 16, false, '急ブレーキの火花'),
  fx('fx_gaan', 64, 64, 2, 8, true, '「ガーン」の稲妻'),
  fx('fx_kiran', 32, 32, 4, 12, false, '「キラーン」の光'),
  fx('fx_explosion', 96, 96, 6, 12, false, '勝利ポーズの背中の爆発')
];

export const IMAGES: ImageDef[] = [
  { key: 'bg_alley_far', w: 216, h: 214, note: '遠くのビルと夜空。左右がつながる' },
  { key: 'bg_alley_wall', w: 648, h: 130, note: '手前の建物の壁。上の空が見えるところは透明。左右がつながる' },
  { key: 'bg_alley_ground', w: 648, h: 90, note: '地面。y=124〜214に置く。左右がつながる' },
  { key: 'logo', w: 200, h: 64, note: 'タイトルのロゴ' },
  { key: 'bg_garage_far', w: 216, h: 214, note: '地下駐車場の奥。暗い壁と遠くの柱。左右がつながる' },
  { key: 'bg_garage_wall', w: 648, h: 130, note: '手前の壁、蛍光灯、案内の矢印、番号の書いた柱(文字はなし)。左右がつながる' },
  { key: 'bg_garage_ground', w: 648, h: 90, note: '駐車場の床。白い線。y=124〜214に置く。左右がつながる' }
];

export const sheetByKey = (key: string): SheetDef => {
  const s = SHEETS.find((d) => d.key === key);
  if (!s) throw new Error(`unknown sheet: ${key}`);
  return s;
};

export const sheetSize = (d: SheetDef): { w: number; h: number } => ({ w: d.cols * d.frameW, h: d.rows.length * d.frameH });

/** アニメーションのキー */
export const animKey = (sheet: string, anim: string): string => `${sheet}.${anim}`;

/** シート全体でのコマ番号 */
export const frameIndex = (d: SheetDef, animName: string, i = 0): number => {
  const row = d.rows.findIndex((r) => r.name === animName);
  if (row < 0) throw new Error(`unknown anim: ${d.key}.${animName}`);
  return row * d.cols + i;
};

/** ステージ2の小物を描くときの色(ゲームの中で人ごとの色に塗り替える)。md(7,0,7) と同じ */
export const KEY_ACCESSORY = 'rgb(255,0,255)';

/** 立っているキャラの足の裏は、コマの下から何ドット上か */
export const FEET_OFFSET = 4;

/**
 * スプライトの原点(setOrigin に渡す値)。position を足の裏や下の真ん中に置けるようにする。
 * 例: this.add.sprite(x, feetY, 'hero').setOrigin(...originFor('hero'))
 */
export const originFor = (key: string): [number, number] => {
  const d = sheetByKey(key);
  if (d.anchor === 'feet') return [0.5, (d.frameH - FEET_OFFSET) / d.frameH];
  if (d.anchor === 'bottom') return [0.5, 1];
  return [0.5, 0.5];
};
