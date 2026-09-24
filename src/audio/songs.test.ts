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
