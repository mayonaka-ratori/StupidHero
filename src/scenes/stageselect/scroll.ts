// ステージを選ぶ画面の、カードの並べ方と、指で上下にずらす動きの計算(docs/SPEC.md「ステージを選ぶ画面」)。
// Phaser を使わないので、scroll.test.ts で確かめる。
//   const lay = listLayout(viewH, n);          // カードの高さ、絵の高さ、全体の高さ、ずらせる量(0ならずらさない)
//   const s = new ListScroll(lay.scrollMax);
//   s.down(id, y, now); s.move(id, y, now);     // 指の動き(y は画面の論理ドット、now はミリ秒)
//   s.up(id, now)                               // 'tap'(8ドットより動かなかった)、'drag'(ずらした)、'none'(すべっているのを止めただけ)
//   s.step(dt)                                  // 毎フレーム。指を離したあとのすべりと、slideTo の動き。ずれが変わったら true
//   s.slideTo(target)                           // 自動でずらす(開いたカードまで)
//   s.pos                                       // いまのずらした量(0がいちばん上。カードは y - pos に描く)
//   showTarget(i, lay, s.pos)                   // i 番目のカードを見える所に出すための、ずらす量
//   initialCard(cards, lastIndex)               // 画面を開いたときに見せるカード
// 画面が高くて全部のカードが入るときは、今までどおり高さを分けて並べ、ずらさない(scrollMax が0)。
// 入らないときは、カードの高さを絵が入る高さに決め(画面の高さで縮めない)、次のカードの頭が少し見えるようにする。

/** カードとカードの間 */
const CARD_GAP = 8;
/** 絵のあるカードの、いちばん低い高さ(絵の高さ58。人の胸から上が見える) */
export const CARD_MIN = 122;
/** ずらさないときのカードの高さの上限 */
const CARD_MAX = 186;
/** ずらすときに、次のカードの頭を見せる高さ(と、見えないまま残す高さ)の下限 */
export const PEEK = 20;
/** カードの名前と記録の欄の高さ(絵の下)。縦に余裕があるときは「タップで出発」の行も足す */
const INFO_H = 64;
const INFO_H_TALL = 80;
const THUMB_MAX = 118;

/** 指がこれより動いたら、ずらす操作(カードのタップにしない) */
export const DRAG_SLOP = 8;
/** 指を離したあとのすべりが弱まる速さ(速さが 1/e になるまでのミリ秒) */
const FRICTION_MS = 325;
/** これより遅くなったら止める(ドット/ミリ秒) */
const STOP_SPEED = 0.01;
/** すべりの速さの上限(ドット/ミリ秒) */
const MAX_SPEED = 3;
/** これより速くすべっている間に触ったら、止めるだけでタップにしない */
const CATCH_SPEED = 0.05;

export interface ListLayout {
  /** カードの枚数 */
  n: number;
  /** カードを並べる所の高さ */
  viewH: number;
  cardH: number;
  /** 絵の高さ */
  thumbH: number;
  gap: number;
  /** カード全部の高さ */
  contentH: number;
  /** 1枚目のカードの上の端(並べる所の上から。ずらさないときは上下の真ん中にそろえる) */
  y0: number;
  /** ずらせる量。0ならずらさない */
  scrollMax: number;
}

const thumbFor = (cardH: number): number => Math.min(THUMB_MAX, cardH - (cardH >= 176 ? INFO_H_TALL : INFO_H));

/**
 * ずらすときのカードの高さ。CARD_MIN から少しずつ高くして、いちばん上にずらしたときに、
 * 並べる所の下の端でカードが PEEK 以上見えて、PEEK 以上かくれる高さを探す(カードの間で切れると、下にまだあると分からない)
 */
function peekHeight(viewH: number, gap: number): number {
  for (let c = CARD_MIN; c <= CARD_MIN + 40; c++) {
    const step = c + gap;
    const k = Math.floor(viewH / step);
    const seen = viewH - k * step;
    if (seen >= PEEK && c - seen >= PEEK) return c;
  }
  return CARD_MIN;
}

/** n 枚のカードを高さ viewH の所に並べる */
export function listLayout(viewH: number, n: number, gap = CARD_GAP): ListLayout {
  const fitH = n > 0 ? Math.min(CARD_MAX, Math.floor((viewH - gap * (n - 1)) / n)) : CARD_MAX;
  if (fitH >= CARD_MIN) {
    const contentH = n > 0 ? fitH * n + gap * (n - 1) : 0;
    return { n, viewH, cardH: fitH, thumbH: thumbFor(fitH), gap, contentH, y0: Math.floor((viewH - contentH) / 2), scrollMax: 0 };
  }
  const cardH = peekHeight(viewH, gap);
  const contentH = cardH * n + gap * (n - 1);
  return { n, viewH, cardH, thumbH: thumbFor(cardH), gap, contentH, y0: 0, scrollMax: Math.max(0, contentH - viewH) };
}

/** i 番目のカードの上の端(並べる所の上から。ずらしていないとき) */
export const cardTop = (lay: ListLayout, i: number): number => lay.y0 + i * (lay.cardH + lay.gap);

const clampScroll = (v: number, max: number): number => Math.min(max, Math.max(0, v));

/**
 * i 番目のカードを全部見えるようにする、ずらす量。もう見えていれば pos のまま。
 * 下にずらすときは、次のカードの頭も少し見えるようにする(上へもどすときは、前のカードのおしりを少し見せる)
 */
export function showTarget(i: number, lay: ListLayout, pos: number): number {
  if (lay.scrollMax <= 0) return 0;
  const top = cardTop(lay, i);
  const bottom = top + lay.cardH;
  const reveal = Math.max(0, Math.min(lay.gap + PEEK, lay.viewH - lay.cardH));
  let target = pos;
  if (bottom > pos + lay.viewH) target = bottom + (i < lay.n - 1 ? reveal : 0) - lay.viewH;
  else if (top < pos) target = top - (i > 0 ? reveal : 0);
  return clampScroll(target, lay.scrollMax);
}

export interface CardState {
  unlocked: boolean;
  /** 遊んだことがある */
  played: boolean;
  /** 開いたばかり(このあと鍵がこわれる演出をする) */
  justUnlocked?: boolean;
}

/**
 * 画面を開いたときに見せるカードの番号。まだ遊んでいない開いたカード(NEW! の札)があればその1枚目、
 * なければ最後に遊んだステージ(lastIndex。分からなければ、遊んだことがあるいちばん後ろのカード)。
 * 開いたばかりのカードは、あとで自動でずらして見せるので、ここでは選ばない
 */
export function initialCard(cards: readonly CardState[], lastIndex = -1): number {
  const fresh = cards.findIndex((c) => c.unlocked && !c.played && !c.justUnlocked);
  if (fresh >= 0) return fresh;
  if (lastIndex >= 0 && lastIndex < cards.length) return lastIndex;
  for (let i = cards.length - 1; i >= 0; i--) if (cards[i].played) return i;
  return 0;
}

/** 指で上下にずらす動き。ずらした量 pos は 0〜max(それより外へはずれない) */
export class ListScroll {
  pos = 0;
  /** すべる速さ(ドット/ミリ秒。+ で下のカードの方へ) */
  vel = 0;
  private finger: { id: number; y: number; pos: number; dragging: boolean; caught: boolean } | null = null;
  private samples: { t: number; y: number }[] = [];
  private anim: { from: number; to: number; ms: number; t: number } | null = null;

  constructor(public max: number) {}

  /** 指を離したあとすべっているか、自動でずらしているか */
  get moving(): boolean { return this.anim !== null || (this.finger === null && this.vel !== 0); }
  /** 指でずらしている最中か */
  get dragging(): boolean { return !!this.finger?.dragging; }
  /** 指が触れているか */
  get touching(): boolean { return this.finger !== null; }

  set(pos: number): void {
    this.pos = clampScroll(pos, this.max);
    this.vel = 0;
    this.anim = null;
  }

  down(id: number, y: number, now: number): void {
    if (this.finger) return;
    // すべっている間に触ったら止める(そのタップではカードを選ばない)
    const caught = this.anim !== null || Math.abs(this.vel) > CATCH_SPEED;
    this.anim = null;
    this.vel = 0;
    this.finger = { id, y, pos: this.pos, dragging: false, caught };
    this.samples = [{ t: now, y }];
  }

  /** 指が動いた。ずらしている最中なら true */
  move(id: number, y: number, now: number): boolean {
    const f = this.finger;
    if (!f || f.id !== id) return false;
    const dy = y - f.y;
    if (!f.dragging && Math.abs(dy) > DRAG_SLOP) f.dragging = true;
    if (!f.dragging) return false;
    // 8ドット動いた所から動き始める(動き出しでカードが跳ばないように)
    this.pos = clampScroll(f.pos - (dy - Math.sign(dy) * DRAG_SLOP), this.max);
    this.samples.push({ t: now, y });
    while (this.samples.length > 2 && now - this.samples[0].t > 120) this.samples.shift();
    return true;
  }

  /** 指を離した */
  up(id: number, now: number): 'tap' | 'drag' | 'none' {
    const f = this.finger;
    if (!f || f.id !== id) return 'none';
    this.finger = null;
    if (!f.dragging) return f.caught ? 'none' : 'tap';
    this.vel = this.releaseSpeed(now);
    return 'drag';
  }

  /** 指を放したことにする(すべらせない。シーンが止まったときなど) */
  cancel(): void {
    this.finger = null;
    this.vel = 0;
  }

  /** 指を離す直前の速さ。最後の動きから80ミリ秒より前に止まっていたら0 */
  private releaseSpeed(now: number): number {
    const s = this.samples;
    const last = s[s.length - 1];
    if (!last || s.length < 2 || now - last.t > 80) return 0;
    const first = s.find((q) => last.t - q.t <= 100) ?? s[0];
    const from = first === last ? s[s.length - 2] : first;
    const v = -(last.y - from.y) / Math.max(1, last.t - from.t);
    return Math.max(-MAX_SPEED, Math.min(MAX_SPEED, v));
  }

  /** target まで自動でずらす。ms を省くと、動く距離で決める */
  slideTo(target: number, ms?: number): void {
    const to = clampScroll(target, this.max);
    this.vel = 0;
    if (Math.abs(to - this.pos) < 0.5) { this.pos = to; this.anim = null; return; }
    this.anim = { from: this.pos, to, ms: ms ?? Math.min(700, 250 + Math.abs(to - this.pos) * 1.5), t: 0 };
  }

  /** 1フレームぶん進める。pos が変わったら true */
  step(dtMs: number): boolean {
    const dt = Math.min(50, Math.max(0, dtMs));
    const before = this.pos;
    if (this.anim) {
      const a = this.anim;
      a.t += dt;
      const k = Math.min(1, a.t / a.ms);
      const e = 1 - (1 - k) ** 3;
      this.pos = a.from + (a.to - a.from) * e;
      if (k >= 1) { this.pos = a.to; this.anim = null; }
    } else if (!this.finger && this.vel !== 0) {
      const next = this.pos + this.vel * dt;
      this.pos = clampScroll(next, this.max);
      // いちばん上と下では止まる
      if (this.pos !== next) this.vel = 0;
      this.vel *= Math.exp(-dt / FRICTION_MS);
      if (Math.abs(this.vel) < STOP_SPEED) this.vel = 0;
    }
    return this.pos !== before;
  }
}
