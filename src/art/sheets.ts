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
  /** 置くときの基準。'feet' = 下から4ドット上の真ん中、'bottom' = 下の真ん中、'center' = 真ん中、'top' = 上の真ん中 */
  anchor: 'feet' | 'bottom' | 'center' | 'top';
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
    a('win_shy', 2, 4, true, '勝利:頭をかいて照れ笑い'),
    a('kick', 5, 16, false, '蹴り。ひざを上げて前へまっすぐ蹴る。ボス戦の連打で使う', [3]),
    a('uppercut', 5, 15, false, 'アッパー。しゃがんで跳び上がりながら拳を突き上げる。ボス戦の連打と、とどめで使う', [3]),
    a('flykick', 6, 14, false, '飛び蹴り。跳んで脚を伸ばして突っこむ。ボス戦の10連打ごとに使う', [4])
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

/** ステージ3の宇宙人:ワルの7行(行6の悪さは「空へ合図を送る」)に、行7「くずれ」を足した8行 */
const alien = (key: string): SheetDef => ({
  key, frameW: 64, frameH: 64, cols: 4, anchor: 'feet',
  rows: [
    ...civRows(),
    a('mischief', 4, 8, false, '悪さ:空へ合図を送る(当たりで手の先が光る)', [3]),
    a('glitch', 4, 20, false, 'くずれ。4コマとも正体が出ている(1:出はじめ、2〜3:いちばん強い、4:戻りかけ)。いつ出すかはコードが決める')
  ]
});

const BOSS3: SheetDef = {
  key: 'boss3', frameW: 96, frameH: 96, cols: 4, anchor: 'feet',
  rows: [
    a('reveal', 4, 10, false, '正体を現す。制服や着ぐるみが裂けて、触角と大きな目'),
    a('idle', 2, 4, true, '待機。腕を組んで浮かぶように揺れる'),
    a('rampage', 4, 10, true, '暴れる。目から光、腕を振り回す'),
    a('hit', 2, 15, true, 'ラッシュを受ける'),
    a('defeat', 4, 8, false, 'やられる。目を回して倒れる'),
    a('board', 4, 10, false, '母艦に乗りこむ。天をさす → しゃがむ → 浮き上がる2コマ(3〜4コマは空中。体の真ん中をそろえる)')
  ]
};

const fx = (key: string, w: number, h: number, frames: number, fps: number, loop: boolean, note: string, anchor: SheetDef['anchor'] = 'center'): SheetDef => ({
  key, frameW: w, frameH: h, cols: frames, anchor, rows: [a('play', frames, fps, loop, note)]
});

/** フリープレイの一目で分かるワル:ふつうのワルと同じ7行。悪さの中身だけ書く */
const freeVillain = (key: string, mischief: string): SheetDef => ({
  key, frameW: 64, frameH: 64, cols: 4, anchor: 'feet',
  rows: [...civRows(), a('mischief', 4, 8, false, mischief, [3])]
});

/** 1コマの小さな絵(小物、ルールの札) */
const still = (key: string, w: number, h: number, anchor: SheetDef['anchor'], note: string): SheetDef => ({
  key, frameW: w, frameH: h, cols: 1, anchor, rows: [a('idle', 1, 1, false, note)]
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
  // ─── ステージ3(docs/STAGE3.md)───
  // 宇宙人の行0〜5は、同じ見た目の市民とまったく同じ絵。違うのは行6と行7だけ
  person('mascot_civ', false), alien('mascot_bad'),
  person('clerk_civ', false), alien('clerk_bad'),
  person('dancer_civ', false), alien('dancer_bad'),
  person('uncle_civ', false), alien('uncle_bad'),
  disguise('boss3_disguise_clerk'), disguise('boss3_disguise_uncle'), disguise('boss3_disguise_mascot'),
  BOSS3,
  propN('prop_ufo', 64, 32, 4, '0〜1:飛ぶ、2:吸い上げる(下のふたが開いて光る)、3:落ちた'),
  propN('prop_mothership', 160, 64, 4, '0〜1:浮かぶ、2:光線(下の砲口が光る)、3:落ちた'),
  prop('prop_gacha', 24, 32, 'bottom'),
  prop('prop_mannequin', 24, 56, 'bottom'),
  prop('prop_showcase', 32, 32, 'bottom'),
  prop('prop_fountain', 64, 40, 'bottom'),
  prop('prop_escalator', 96, 64, 'bottom'),
  // UFOの吸い上げる光(fx_beam はヒーローの必殺技の光線が使っているので、別のキーにした)
  fx('fx_ufobeam', 32, 64, 4, 12, true, 'UFOの吸い上げる光。上の端をUFOの口に合わせる。ゲームの中で1コマおきに点滅させる', 'top'),
  fx('fx_glitch', 64, 64, 4, 20, true, 'くずれのノイズ(黄緑)。体全体に重ねる。ゲームの中で1コマおきに点滅させる'),
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
  fx('fx_explosion', 96, 96, 6, 12, false, '勝利ポーズの背中の爆発'),
  // ─── フリープレイ(docs/FREEPLAY.md)───
  // 一目で分かるワル。武器は顔の向きの側に、波3の小物は頭の上と後ろに来るように描いてある
  freeVillain('fp_mohawk', '悪さ:ナイフで脅す(振りかぶる → 踏みこむ → 前へ突き出す(当たり) → 突きつけたまま)'),
  freeVillain('fp_gang', '悪さ:口笛で仲間を呼ぶ(地下駐車場のギャングと同じ。手まねきする手でバットを振り上げる)'),
  freeVillain('fp_alien', '悪さ:空へ合図を送る(ショッピングモールの宇宙人と同じ。当たりで手の先が光る)'),
  // 波3の小物。人の絵に重ねる別の絵で、付ける場所は src/art/free/items.ts の itemAnchor。右向きの人に合わせて描いてある
  { key: 'fp_item_balloon', frameW: 32, frameH: 48, cols: 2, anchor: 'bottom',
    rows: [a('float', 2, 3, true, '黄色の風船がゆれる。ひもの下の端(下の真ん中)を手に合わせる。玉は頭の上の後ろ寄りに浮かぶ')] },
  still('fp_item_hat', 16, 20, 'bottom', '濃い緑のとんがり帽子(14×15)。下の真ん中を頭のてっぺんに合わせる'),
  still('fp_item_bag', 16, 16, 'top', '茶色の大きな紙袋(袋は11×11)。持ち手のてっぺん(上の真ん中)を手に合わせる'),
  // ルールの札の絵
  still('ui_rule_fist', 16, 16, 'center', '拳(殴りかかる)'),
  still('ui_rule_palm', 16, 16, 'center', '手のひら(素通りする)'),
  still('ui_item_balloon', 16, 16, 'center', '風船'),
  still('ui_item_hat', 16, 16, 'center', 'とんがり帽子'),
  still('ui_item_bag', 16, 16, 'center', '紙袋'),
  // ヒーローの光。fx_aura と同じ大きさで同じように置く。光は1コマおきに点滅させ、*_line は点滅させない
  fx('fx_aura_attack', 64, 64, 4, 12, true, '殴りかかるときの光。赤いトゲトゲの輪'),
  fx('fx_aura_pass', 64, 64, 4, 8, true, '素通りするときの光。水色の丸い輪と泡'),
  fx('fx_aura_attack_line', 64, 64, 1, 1, false, '光と揺れを弱くするときの、殴りかかるほうのふち取り(トゲトゲ)。点滅させない'),
  fx('fx_aura_pass_line', 64, 64, 1, 1, false, '光と揺れを弱くするときの、素通りのほうのふち取り(丸)。点滅させない')
];

export const IMAGES: ImageDef[] = [
  { key: 'bg_alley_far', w: 216, h: 214, note: '遠くのビルと夜空。左右がつながる' },
  { key: 'bg_alley_wall', w: 648, h: 130, note: '手前の建物の壁。上の空が見えるところは透明。左右がつながる' },
  { key: 'bg_alley_ground', w: 648, h: 90, note: '地面。y=124〜214に置く。左右がつながる' },
  { key: 'logo', w: 200, h: 64, note: 'タイトルのロゴ' },
  { key: 'bg_garage_far', w: 216, h: 214, note: '地下駐車場の奥。暗い壁と遠くの柱。左右がつながる' },
  { key: 'bg_garage_wall', w: 648, h: 130, note: '手前の壁、蛍光灯、案内の矢印、番号の書いた柱(文字はなし)。左右がつながる' },
  { key: 'bg_garage_ground', w: 648, h: 90, note: '駐車場の床。白い線。y=124〜214に置く。左右がつながる' },
  { key: 'bg_mall_far', w: 216, h: 214, note: '閉店まぎわのモールの吹き抜け。上の階の店と天窓の夜空。左右がつながる' },
  { key: 'bg_mall_wall', w: 648, h: 130, note: '1階の店の並び。シャッター、ショーウィンドウ、天井の照明。上の吹き抜けは透明。左右がつながる' },
  { key: 'bg_mall_ground', w: 648, h: 90, note: 'みがいたタイルの床。照明の映りこみ。y=124〜214に置く。左右がつながる' }
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
 * スプライトの原点(setOrigin に渡す値)。position を足の裏や下の真ん中、上の真ん中に置けるようにする。
 * 例: this.add.sprite(x, feetY, 'hero').setOrigin(...originFor('hero'))
 */
export const originFor = (key: string): [number, number] => {
  const d = sheetByKey(key);
  if (d.anchor === 'feet') return [0.5, (d.frameH - FEET_OFFSET) / d.frameH];
  if (d.anchor === 'bottom') return [0.5, 1];
  if (d.anchor === 'top') return [0.5, 0];
  return [0.5, 0.5];
};
