import { describe, expect, it } from 'vitest';
import { compile } from './sequencer';
import { INSTRUMENTS } from './patches';
import { SONGS } from './songs';

describe('曲のデータ', () => {
  it('どの曲も音符の予定表にできる(知らない楽器や音の名前がない)', () => {
    for (const [name, song] of Object.entries(SONGS)) {
      expect(() => compile(song), name).not.toThrow();
      for (const sec of [song.intro, song.loop]) {
        for (const tr of sec?.tracks ?? []) {
          if (tr.inst !== 'drums') expect(INSTRUMENTS[tr.inst], `${name} ${tr.inst}`).toBeDefined();
        }
      }
    }
  });

  it('トラックの長さは区間の長さを割り切る(数えまちがいでずれない)', () => {
    for (const [name, song] of Object.entries(SONGS)) {
      for (const sec of [song.intro, song.loop]) {
        if (!sec) continue;
        for (const tr of sec.tracks) {
          const n = tr.notes.trim().split(/\s+/).length;
          expect((sec.bars * 16) % n, `${name} ${tr.inst} ${n}マス`).toBe(0);
        }
      }
    }
  });

  it('エレベーターラッシュの曲は、17〜20秒かけて速く高くなってから、いちばん速いところをくり返す', () => {
    const s = compile(SONGS.lift4);
    const introSec = (s.intro?.steps ?? 0) * (60 / s.bpm / 4);
    expect(introSec).toBeGreaterThanOrEqual(17);
    expect(introSec).toBeLessThanOrEqual(20);
    // 節の最初の音(ビブラフォン)の高さと、2つめの音までのマスの数を、前奏の区切りごとに見る
    const lead = (at: { inst: string; midi: number }[][]) =>
      at.flatMap((evs, i) => evs.filter((e) => e.inst === 'vibes').map((e) => ({ i, midi: e.midi })));
    const intro = lead(s.intro?.at ?? []);
    const loop = lead(s.loop.at);
    const heads = [0, 17, 34].map((k) => intro[k]);
    const gaps = [0, 17, 34].map((k) => intro[k + 1].i - intro[k].i);
    expect(heads.map((h) => h.midi)).toEqual([69, 71, 73]);
    expect(gaps).toEqual([7, 6, 5]);
    expect(loop[0].midi).toBe(74);
    expect(loop[1].i - loop[0].i).toBe(4);
  });

  it('フリープレイの曲は同じ曲で、波ごとに少しずつ速い', () => {
    const { free1, free2, free3 } = SONGS;
    expect(free2.loop).toBe(free1.loop);
    expect(free3.loop).toBe(free1.loop);
    expect(free1.bpm).toBeGreaterThan(SONGS.street.bpm);
    expect(free2.bpm).toBeGreaterThan(free1.bpm);
    expect(free3.bpm).toBeGreaterThan(free2.bpm);
    // 「少し」ずつ(1段で1割より小さく上げる)
    expect(free2.bpm / free1.bpm).toBeLessThan(1.1);
    expect(free3.bpm / free2.bpm).toBeLessThan(1.1);
  });
});
