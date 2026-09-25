import { describe, expect, it } from 'vitest';
import { CARD_MIN, DRAG_SLOP, ListScroll, PEEK, cardTop, initialCard, listLayout, showTarget } from './scroll';

/** 画面の高さ H のときの、カードを並べる所の高さ(StageSelect.ts と同じ計算。下のホームバーはなし) */
const viewOf = (H: number): number => H - 6 - 26 - 8 - 44;

/** いちばん上にずらしたときに、並べる所の下の端で切れているカードの、見えている高さ */
function peekSeen(H: number, n: number): { seen: number; hidden: number } {
  const lay = listLayout(viewOf(H), n);
  for (let i = 0; i < n; i++) {
    const top = cardTop(lay, i), bottom = top + lay.cardH;
    if (bottom > lay.viewH) return { seen: lay.viewH - top, hidden: bottom - lay.viewH };
  }
  return { seen: 0, hidden: 0 };
}

describe('listLayout', () => {
  it('高さ468で3枚なら、今までどおり高さを分けて並べ、ずらさない', () => {
    const lay = listLayout(viewOf(468), 3);
    expect(lay.scrollMax).toBe(0);
    expect(lay.cardH).toBe(122);
    expect(lay.thumbH).toBe(58);
    expect(lay.y0 + lay.contentH).toBeLessThanOrEqual(lay.viewH);
  });

  it('入りきらないときは、絵を細くせずにずらす。カードの絵はいつも出る', () => {
    for (const n of [3, 4, 5]) {
      for (let H = 384; H <= 468; H += 4) {
        const lay = listLayout(viewOf(H), n);
        expect(lay.cardH).toBeGreaterThanOrEqual(CARD_MIN);
        expect(lay.thumbH).toBeGreaterThanOrEqual(58);
        if (lay.scrollMax > 0) expect(lay.contentH - lay.scrollMax).toBe(lay.viewH);
      }
    }
    expect(listLayout(viewOf(384), 3).scrollMax).toBeGreaterThan(0);
    expect(listLayout(viewOf(468), 4).scrollMax).toBeGreaterThan(0);
  });

  it('ずらすときは、次のカードの頭が少し見えて、少しかくれている(カードの間で切れない)', () => {
    for (const n of [3, 4]) {
      for (let H = 384; H <= 468; H++) {
        if (listLayout(viewOf(H), n).scrollMax === 0) continue;
        const p = peekSeen(H, n);
        expect(p.seen, `H=${H} n=${n}`).toBeGreaterThanOrEqual(PEEK);
        expect(p.hidden, `H=${H} n=${n}`).toBeGreaterThanOrEqual(PEEK);
      }
    }
  });

  it('1枚や2枚ならずらさない', () => {
    expect(listLayout(viewOf(384), 1).scrollMax).toBe(0);
    expect(listLayout(viewOf(384), 2).scrollMax).toBe(0);
    expect(listLayout(viewOf(384), 0).contentH).toBe(0);
  });
});

describe('ListScroll', () => {
  it('8ドットまでの動きはタップ。それより動いたらずらす操作', () => {
    const s = new ListScroll(200);
    s.down(1, 100, 0);
    expect(s.move(1, 100 - DRAG_SLOP, 16)).toBe(false);
    expect(s.up(1, 32)).toBe('tap');
    expect(s.pos).toBe(0);
    s.down(1, 100, 100);
    expect(s.move(1, 100 - DRAG_SLOP - 1, 116)).toBe(true);
    expect(s.up(1, 300)).toBe('drag');
  });

  it('指を上へ動かすと下のカードの方へずれる。8ドットをこえた分だけ動き、跳ばない', () => {
    const s = new ListScroll(200);
    s.down(1, 200, 0);
    s.move(1, 191, 10);
    expect(s.pos).toBe(1);
    s.move(1, 150, 20);
    expect(s.pos).toBe(42);
    s.move(1, 250, 30);
    expect(s.pos).toBe(0);
  });

  it('いちばん上と下では、それ以上ずれない', () => {
    const s = new ListScroll(100);
    s.down(1, 300, 0);
    s.move(1, 0, 10);
    expect(s.pos).toBe(100);
    s.move(1, 600, 20);
    expect(s.pos).toBe(0);
  });

  it('指を離したあとは少しすべって止まる。端では止まる', () => {
    const s = new ListScroll(1000);
    s.down(1, 300, 0);
    for (let t = 10; t <= 100; t += 10) s.move(1, 300 - t * 1, t);
    expect(s.up(1, 100)).toBe('drag');
    const at = s.pos;
    expect(s.vel).toBeGreaterThan(0.5);
    expect(s.moving).toBe(true);
    for (let i = 0; i < 300; i++) s.step(16);
    expect(s.moving).toBe(false);
    expect(s.pos).toBeGreaterThan(at + 100);
    expect(s.pos).toBeLessThan(at + 700);

    const t = new ListScroll(120);
    t.down(1, 300, 0);
    for (let k = 10; k <= 60; k += 10) t.move(1, 300 - k * 2, k);
    t.up(1, 60);
    for (let i = 0; i < 300; i++) t.step(16);
    expect(t.pos).toBe(120);
    expect(t.vel).toBe(0);
  });

  it('止まってから離したら、すべらない', () => {
    const s = new ListScroll(500);
    s.down(1, 300, 0);
    s.move(1, 200, 50);
    s.move(1, 200, 60);
    s.up(1, 300);
    expect(s.vel).toBe(0);
    expect(s.moving).toBe(false);
  });

  it('すべっている間に触ったら止まるだけで、タップにしない', () => {
    const s = new ListScroll(1000);
    s.down(1, 300, 0);
    for (let t = 10; t <= 80; t += 10) s.move(1, 300 - t * 2, t);
    s.up(1, 80);
    s.step(16);
    s.down(2, 200, 100);
    expect(s.vel).toBe(0);
    expect(s.up(2, 150)).toBe('none');
    const at = s.pos;
    s.step(16);
    expect(s.pos).toBe(at);
    // 止まったあとのタップはふつうに効く
    s.down(1, 200, 200);
    expect(s.up(1, 250)).toBe('tap');
  });

  it('ほかの指は無視する', () => {
    const s = new ListScroll(200);
    s.down(1, 300, 0);
    s.down(2, 100, 5);
    expect(s.move(2, 0, 10)).toBe(false);
    expect(s.up(2, 20)).toBe('none');
    expect(s.up(1, 30)).toBe('tap');
  });

  it('slideTo で自動でずらし、着いたら止まる', () => {
    const s = new ListScroll(300);
    s.slideTo(250);
    expect(s.moving).toBe(true);
    let changed = false;
    for (let i = 0; i < 100; i++) changed = s.step(16) || changed;
    expect(changed).toBe(true);
    expect(s.pos).toBe(250);
    expect(s.moving).toBe(false);
    s.slideTo(999);
    for (let i = 0; i < 100; i++) s.step(16);
    expect(s.pos).toBe(300);
  });
});

describe('showTarget', () => {
  const lay = listLayout(viewOf(384), 4);

  it('見えているカードなら、そのまま', () => {
    expect(showTarget(0, lay, 0)).toBe(0);
    expect(showTarget(1, lay, 0)).toBe(0);
  });

  it('下のカードは全部見えるまでずらし、次のカードの頭も見せる。最後のカードはいちばん下まで', () => {
    const p = showTarget(2, lay, 0);
    const top = cardTop(lay, 2);
    expect(top).toBeGreaterThanOrEqual(p);
    expect(top + lay.cardH).toBeLessThanOrEqual(p + lay.viewH - PEEK);
    expect(showTarget(3, lay, 0)).toBe(lay.scrollMax);
  });

  it('上のカードへもどすときも、全部見えるまで', () => {
    const p = showTarget(1, lay, lay.scrollMax);
    expect(cardTop(lay, 1)).toBeGreaterThanOrEqual(p);
    expect(showTarget(0, lay, lay.scrollMax)).toBe(0);
  });

  it('ずらさない並べ方では0', () => {
    expect(showTarget(2, listLayout(viewOf(468), 3), 0)).toBe(0);
  });
});

describe('initialCard', () => {
  const played = { unlocked: true, played: true };
  const fresh = { unlocked: true, played: false };
  const locked = { unlocked: false, played: false };

  it('まだ遊んでいない開いたカード(NEW!)があれば、そこ', () => {
    expect(initialCard([played, played, fresh, locked], 0)).toBe(2);
    expect(initialCard([fresh, locked, locked, locked])).toBe(0);
  });

  it('なければ最後に遊んだステージ。分からなければ遊んだことがあるいちばん後ろ', () => {
    expect(initialCard([played, played, played, locked], 1)).toBe(1);
    expect(initialCard([played, played, played, locked])).toBe(2);
  });

  it('開いたばかりのカードは選ばない(あとで自動でずらす)', () => {
    expect(initialCard([played, played, played, { ...fresh, justUnlocked: true }], 2)).toBe(2);
  });
});
