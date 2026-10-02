// 仕分けの画面の上の札の置き場(Phaser を使わない。hudLayout.test.ts で、札どうしが重ならないことを確かめる)。
//
// 左の列(x 4〜72):ステージ、何人目、時間のバー、時間の数字。その下に札を2つ出す。
//   「▲5人ぶん」     波の始まりに4秒(時間が1人ずつではなく、全員で分けるものだと分かるように)。時間の数字のすぐ下
//   「時計ストップ中」 文字送りの間。ふだんは時間の数字のすぐ下で、「▲5人ぶん」が出ている間はその下へずらす
// 右(x 72から):ステージ2の「見た小物」の札の並び(seenStrip.ts。その大きさもここで決める)。
// 字の幅は、DotGothic16 が全角は字の大きさ、半角はその半分なので、それで見積もる。
//
// 使い方:
//   shareTagText(5)                       // '▲5人ぶん'
//   stopTagY(shareShown)                  // 「時計ストップ中」の札の上の端
//   stripBox(STRIP_X, STRIP_Y, 6)         // 「見た小物」で6人ぶん並べたときに使う所

export interface Box { x: number; y: number; w: number; h: number }

/** 字の大きさ(ui/theme.ts の FS と同じ) */
const FS_SMALL = 10;
const FS_BODY = 12;

/** 左の列の左の端と、札が使ってよい右の端(その右は「見た小物」と人の絵) */
export const COL_X = 4;
export const COL_RIGHT = 72;
/** 時間の数字(16の字)の上の端 */
export const SEC_Y = 44;
const SEC_SIZE = 16;
/** 時間の数字の下の、札を置き始める高さ */
export const TAG_TOP = SEC_Y + SEC_SIZE + 3;
/** 札と札の間 */
export const TAG_GAP = 2;

/** 「◀ワル」の字(左の端の、縦に3字)の真ん中の高さ。札はこれより上に収める */
export const EDGE_LABEL_Y = 140;

/** 「▲5人ぶん」の札の字(上の時間を指す) */
export const shareTagText = (people: number): string => `▲${people}人ぶん`;
/** 「時計ストップ中」の札の字 */
export const STOP_TAG_TEXT = '時計\nストップ中';

/** 札のふち(字のまわりのすき間) */
export const SHARE_PAD = { w: 8, h: 3 } as const;
export const STOP_PAD = { w: 8, h: 5 } as const;

/** 字の幅の見積もり(半角は字の大きさの半分、ほかは字の大きさ) */
export function textWidth(text: string, size: number): number {
  let w = 0;
  for (const ch of text) w += /[\x20-\x7e]/.test(ch) ? size / 2 : size;
  return w;
}

/** 何行かの字の大きさ(行の間は lineSpacing) */
export function textBox(text: string, size: number, lineSpacing = 0): { w: number; h: number } {
  const lines = text.split('\n');
  return { w: Math.max(...lines.map((l) => textWidth(l, size))), h: lines.length * size + (lines.length - 1) * lineSpacing };
}

/** 「▲5人ぶん」の札の所 */
export function shareTagBox(people: number): Box {
  const t = textBox(shareTagText(people), FS_BODY);
  return { x: COL_X, y: TAG_TOP, w: t.w + SHARE_PAD.w, h: t.h + SHARE_PAD.h };
}

/** 「時計ストップ中」の札の上の端。「▲5人ぶん」の札が出ていれば、その下 */
export function stopTagY(shareShown: boolean): number {
  return shareShown ? TAG_TOP + textBox('▲', FS_BODY).h + SHARE_PAD.h + TAG_GAP : TAG_TOP;
}

/** 「時計ストップ中」の札の所 */
export function stopTagBox(shareShown: boolean): Box {
  const t = textBox(STOP_TAG_TEXT, FS_BODY, 2);
  return { x: COL_X, y: stopTagY(shareShown), w: t.w + STOP_PAD.w, h: t.h + STOP_PAD.h };
}

// ─── 「見た小物」(seenStrip.ts) ───

/** 「見た小物」の左上(左の列の右) */
export const STRIP_X = 72;
export const STRIP_Y = 21;
/** 札の大きさ(黒いふちを含む) */
export const CHIP = 12;
/** 1行に並べる札の数と、1つぶんの幅 */
export const PER_ROW = 4;
export const SLOT_W = 34;
/** 1行の高さ(札と、その下の番号) */
export const ROW_H = 26;
/** 見出しの下から札までのすき間 */
export const STRIP_TITLE_GAP = 3;

/** i 番目(0始まり)の札の左上 */
export function chipAt(x: number, y: number, i: number): { x: number; y: number } {
  const col = i % PER_ROW, row = Math.floor(i / PER_ROW);
  return { x: x + col * SLOT_W + Math.floor((SLOT_W - CHIP) / 2), y: y + FS_BODY + STRIP_TITLE_GAP + row * ROW_H };
}

/**
 * n 人ぶん並べたときに使う所(見出し、札といまの人の白いわく、その下の番号)。
 * 横は札1つぶんの幅(SLOT_W)ずつ。白いわくと番号(「8人目」でも30ドットより短い)は、その中に収まる
 */
export function stripBox(x: number, y: number, n: number): Box {
  const rows = Math.max(1, Math.ceil(n / PER_ROW));
  const cols = Math.min(Math.max(n, 1), PER_ROW);
  const last = chipAt(x, y, (rows - 1) * PER_ROW);
  // 番号(10の字)は札の2ドット下から
  const bottom = last.y + CHIP + 2 + FS_SMALL;
  return { x, y, w: Math.max(textWidth('見た小物', FS_BODY), cols * SLOT_W), h: bottom - y };
}

/** 2つの四角が重なるか(辺が接するだけなら重ならない) */
export const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
