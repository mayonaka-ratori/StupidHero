// 公開版(コミット 876e008)との比べ合わせ。
// fixtures/ の JSON は、公開版の src/logic をそのまま動かして作った「固定の答え」。作り直さないこと
// (ステージ1の中身をわざと変えたときだけ、理由を書いて作り直す)。
// 公開版からある項目だけを比べる。ステージ2で増えた項目(groups、accessory、link など)は比べない。
// 仕分けの見直しで、波の時間、プロフィールの一文、オペレーターの一言はわざと変えた(下の asPublished を見る)。
// fixture は作り直さず、比べる項目からそれらを外した。
// 手がかりの出し分け(tells.ts)で、パーカー、スーツ、買い物袋の人の絵のキーは 'hoodie_bad_knuckles' のように
// 後ろに名前がつくようになった。出し分けは別の乱数で選ぶので、誰がどの順で出るかは変わらない。絵のキーは元の絵のキーに直して比べる。

import { beforeEach, describe, expect, it } from 'vitest';
import alleyV1 from './fixtures/alley-v1.json';
import recordsV1 from './fixtures/records-v1.json';
import {
  ATTACK_SHOUTS, MISCHIEF_LINES, reactionList, titleCommentFor, waveIntroFor,
  type ReactionKey
} from './content';
import { clearRecords, isStageUnlocked, loadRecords, saveResult } from './records';
import { createStage } from './stage';
import { baseSheetKey } from './tells';
import { StatsTracker } from './stats';
import { MemStorage } from './testHelpers';
import { decideTitle, titlesFor } from './titles';
import type { Person, Stage, StageStats, TitleId, WaveNo } from './types';

/** undefined の項目は書かない(JSON と同じ形にする) */
function pick<T extends object>(obj: T, keys: readonly (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

/**
 * 公開版の Person にある項目だけ。
 * わざと変えたもの(波の時間 seconds、プロフィールの一文 profile.line、オペレーターの一言 hint)は比べない。
 * 時間は長くし(rules.ts の WAVES)、文と一言はどちらとも取れるものを足して顔をそろえた(content.ts)。
 * 文の一覧が長くなっても、選ぶときの乱数を引く回数は変わらない(pickFresh は1回だけ引く)ので、
 * 誰がどの順で出るか、名前、年齢などはこれまでと同じになる。それをここで確かめる
 */
const PERSON_KEYS = ['id', 'index', 'wave', 'look', 'truth', 'sheetKey', 'disguise', 'mischief'] as const;
const asPublished = (s: Stage) => ({
  ...pick(s, ['id', 'name', 'seed', 'villainTotal', 'peopleTotal']),
  waves: s.waves.map((w) => ({
    ...pick(w, ['no', 'badCount', 'hasBoss']),
    people: w.people.map((p: Person) => ({
      ...pick({ ...p, sheetKey: baseSheetKey(p.sheetKey) }, PERSON_KEYS),
      profile: pick(p.profile, ['name', 'age'])
    }))
  }))
});

/**
 * 結果発表の作り直しで、わざと変えたセリフ(まったく比べない)。
 * streetWatch:待てと行けの使い方は、初めて合図が出たときに言う(teachStop、teachGo)ので、なくした。
 * oops:市民をワルにして殴ったときは言いはる流れ(stubborn)になり、巻きぞえのときだけ使うので「市民だった!」を替えた
 * timeUpOp:どこからも使っていなかったので消した
 */
const REDESIGNED_REACTIONS = new Set(['streetWatch', 'oops', 'timeUpOp']);

/**
 * 文だけを直したセリフ(文は比べず、数と、だれが言うか(who)と顔(face)は比べる。数が同じなら乱数の引き方も同じ)。
 * collateral、stopOp、stopFailBoss、bossRevealHero:セリフの見直しで、不自然な言い方と古い言い方を直した
 * (「関係ない人!」「了解、次!」「こいつは止まれない!」「見破ったり!」など)
 * stop:言い方の見直し(ヒーローのため口に合わせて「止まります」を「止まるよ」)で直した。
 * judgeRight、stubborn、ownFault も同じとき(「ひと目」を「一目」、「怪しかった」を「あやしかった」、
 * 「ワルの札」を「ワルのハンコ」)に文を直したが、公開版にはないセリフなので fixture に入っていない(ここでは比べるものがない)
 */
const TEXT_ONLY_REACTIONS = new Set(['collateral', 'stopOp', 'stopFailBoss', 'bossRevealHero', 'stop', 'judgeRight', 'stubborn', 'ownFault']);
/** セリフの一覧から、文を除いた形(数、だれが言うか、顔) */
const withoutText = (list: readonly { who?: string; face?: string }[]) => list.map(({ who, face }) => ({ who, face }));

/** fixture の答えから、わざと変えた項目を取りのぞく */
type FixtureStage = (typeof alleyV1.stages)[number]['stage'];
const withoutChanged = (s: FixtureStage) => ({
  ...s,
  waves: s.waves.map(({ seconds: _s, people, ...w }) => ({
    ...w,
    people: people.map(({ hint: _h, profile: { line: _l, ...profile }, ...p }) => ({ ...p, profile }))
  }))
});

/**
 * 称号の条件をわざと変えたので、公開版と答えがちがう記録(fixtures の titles の番号)。
 * - 連打の申し子:5秒以内 → 7秒以内
 * - 完全無欠、街のほんものヒーロー:巻きぞえの市民は数えない(運で取れなくなるのを防ぐ)
 * - 正義の暴走機関車:ワルに襲われた市民は数えない(ヒーローが傷つけた市民だけ)
 * - やさしすぎるヒーロー:なぐった市民だけを見る(逃がしたワルに襲われた市民と巻きぞえは数えない)
 * - おばあちゃんの敵:おばあさんを直接なぐったときだけ(巻きぞえは数えない)
 * - 歩く解体工事:路地裏は¥5,000万以上 → ¥1,500万以上(ステージごとに金額を分けた。¥2,300万と¥4,999万の記録が入る)
 * - 歩く解体工事を調べる順を、ボスの親友のあとに下げた(ボスが暴れた額で届いて、ボスの親友が出なくなるため)。
 *   ボスを市民に仕分けた記録(#31、#50、#62)は、公開版と同じボスの親友のまま
 */
const DEMOLITION = '路地裏の歩く解体工事は¥1,500万以上(おばあちゃんの敵、暴走機関車、待ての達人より先)';
/** 調べる順をわざと変えた称号(公開版の並びから、歩く解体工事をボスの親友のあとへ動かす) */
const publishedOrderNow = (defs: readonly { id: string }[]) => {
  const out = defs.filter((d) => d.id !== 'demolition');
  out.splice(out.findIndex((d) => d.id === 'bossBuddy') + 1, 0, defs.find((d) => d.id === 'demolition')!);
  return out;
};
const CHANGED_TITLES: Readonly<Record<number, { was: TitleId; now: TitleId; why: string }>> = {
  7: { was: 'soSo', now: 'demolition', why: DEMOLITION },
  13: { was: 'soSo', now: 'tapProdigy', why: '5.01秒は7秒以内' },
  19: { was: 'soSo', now: 'demolition', why: DEMOLITION },
  20: { was: 'soSo', now: 'demolition', why: DEMOLITION },
  23: { was: 'soSo', now: 'tapProdigy', why: '5.5秒は7秒以内' },
  29: { was: 'soSo', now: 'tapProdigy', why: '5.5秒は7秒以内' },
  32: { was: 'stopMaster', now: 'tapProdigy', why: '5.5秒は7秒以内(待ての達人より先)' },
  46: { was: 'grannyFoe', now: 'soSo', why: 'ヒーローがなぐった市民がいないので、おばあさんはなぐっていない' },
  48: { was: 'stopMaster', now: 'demolition', why: DEMOLITION },
  60: { was: 'soSo', now: 'demolition', why: DEMOLITION },
  63: { was: 'grannyFoe', now: 'stopMaster', why: 'おばあさんに当たったのは巻きぞえだけ' },
  66: { was: 'soSo', now: 'flawless', why: '巻きぞえ1人だけなら完全無欠' },
  70: { was: 'runawayTrain', now: 'demolition', why: DEMOLITION },
  72: { was: 'grannyFoe', now: 'chaseDemon', why: 'おばあさんに当たったのは巻きぞえだけ' },
  75: { was: 'chaseDemon', now: 'tapProdigy', why: '5.5秒は7秒以内(追い打ちの鬼より先)' },
  76: { was: 'grannyFoe', now: 'demolition', why: DEMOLITION }
};

describe('ステージ1は公開版(876e008)と同じ', () => {
  it(`createStage(seed) の中身が同じ(${alleyV1.stages.length}個の種。時間、文、一言はわざと変えたので比べない)`, () => {
    for (const { seed, stage } of alleyV1.stages) {
      expect(asPublished(createStage(seed)), `seed ${seed}`).toEqual(withoutChanged(stage));
    }
  });
  // わざと変えた文と一言が、その人の見た目と正体の一覧から選ばれることは stage.test.ts で確かめる

  // ステージ前の掛け合い(INTRO)は、初めての1分を短くするためにわざと変えたので比べない
  it('波の始まりのセリフ、セリフ、称号のひとことが同じ', () => {
    const sp = alleyV1.speech;
    for (const no of [1, 2, 3] as WaveNo[]) expect(waveIntroFor('alley', no), `wave ${no}`).toEqual(sp.WAVE_INTRO[no as 1 | 2 | 3]);
    for (const [k, list] of Object.entries(sp.REACTIONS)) {
      if (REDESIGNED_REACTIONS.has(k)) continue;
      if (TEXT_ONLY_REACTIONS.has(k)) {
        expect(withoutText(reactionList(k as ReactionKey, 'alley')), `${k}(文のほか)`).toEqual(withoutText(list));
        continue;
      }
      expect(reactionList(k as ReactionKey, 'alley'), k).toEqual(list);
    }
    // 技はあとから4つ(アッパー、飛び蹴り、投げ、ヒップアタック)足したので、公開版にある技だけを比べる
    for (const [k, list] of Object.entries(sp.ATTACK_SHOUTS)) expect(ATTACK_SHOUTS[k as keyof typeof ATTACK_SHOUTS], k).toEqual(list);
    for (const [k, list] of Object.entries(sp.MISCHIEF_LINES)) expect(MISCHIEF_LINES[k as keyof typeof MISCHIEF_LINES], k).toEqual(list);
    for (const [id, c] of Object.entries(sp.TITLE_COMMENTS)) expect(titleCommentFor(id as TitleId, 'alley'), id).toEqual(c);
  });

  it(`称号の並びと、decideTitle の答えが同じ(${alleyV1.titles.length}通りの記録。わざと変えた条件の分は除く)`, () => {
    expect(titlesFor('alley').map((t) => ({ id: t.id, name: t.name, pose: t.pose }))).toEqual(publishedOrderNow(alleyV1.titleDefs));
    // 新しく増えた項目は、路地裏で遊んだときと同じ値(0 など)にする
    const zero = new StatsTracker(9, 'alley').snapshot();
    alleyV1.titles.forEach(({ stats, title, name }, i) => {
      // 公開版の記録には、おばあさんを直接なぐったか巻きぞえかの区別がない。
      // ヒーローがなぐった市民がいれば、なぐったのはおばあさんだったことにする
      const grannyPunched = stats.grannyHit && stats.civHurtByHero > 0;
      const s = { ...zero, ...stats, grannyPunched, propsBroken: { ...zero.propsBroken, ...stats.propsBroken } } as StageStats;
      const t = decideTitle(s);
      const changed = CHANGED_TITLES[i];
      if (changed) {
        // わざと変えた分:公開版の答えとちがい、新しい条件の答えになる
        expect(title, `#${i} 公開版の答え`).toBe(changed.was);
        expect(t.id, `#${i} ${changed.why}`).toBe(changed.now);
        return;
      }
      expect({ id: t.id, name: t.name }, JSON.stringify(stats)).toEqual({ id: title, name });
    });
  });
});

describe('公開版が保存した記録を今の版で読める', () => {
  beforeEach(() => clearRecords(null));

  it('遊んだ回数、記録、称号を引きつぎ、ボスを倒していればステージ2が開く', () => {
    const st = new MemStorage();
    st.setItem(recordsV1.key, recordsV1.cleared.text);
    const old = recordsV1.cleared.loaded.stages.alley;
    const r = loadRecords(st);
    expect(r.stages.alley).toMatchObject(old);
    expect(r.stages.alley!.titles).toEqual(recordsV1.cleared.loaded.titles);
    expect(r.titles).toEqual(recordsV1.cleared.loaded.titles);
    expect(isStageUnlocked('garage', r)).toBe(true);

    // 続けて遊ぶと、回数が増え、前の記録と比べて新記録を決める。公開版の文字列は消さない
    const zero = new StatsTracker(9, 'alley').snapshot();
    const s = saveResult('alley', { ...zero, defeated: 5, civHurt: 1, damage: 70_000_000, bossDefeated: true, bossFightSec: 6 }, 'demolition', st);
    expect(s.firstPlay).toBe(false);
    expect(s.stage.plays).toBe(old.plays + 1);
    expect(s.newRecords).toEqual(['highestDamage']);
    expect(s.titleIsNew).toBe(false);
    expect(s.titlesCollected).toBe(recordsV1.cleared.loaded.titles.length);
    expect(s.unlockedNow).toEqual([]);
    expect(st.getItem(recordsV1.key)).toBe(recordsV1.cleared.text);

    // ステージ2も遊べて、記録は別に残る
    const g = saveResult('garage', { ...new StatsTracker(10, 'garage').snapshot(), defeated: 3 }, 'soSo', st);
    expect(g.firstPlay).toBe(true);
    expect(loadRecords(st).stages.alley!.plays).toBe(old.plays + 1);
    expect(loadRecords(st).stages.garage!.plays).toBe(1);
  });

  it('ボスを倒していない記録なら、引きつぐがステージ2は閉じたまま', () => {
    const st = new MemStorage();
    st.setItem(recordsV1.key, recordsV1.noBoss.text);
    const r = loadRecords(st);
    expect(r.stages.alley).toMatchObject(recordsV1.noBoss.loaded.stages.alley);
    expect(r.titles).toEqual(recordsV1.noBoss.loaded.titles);
    expect(isStageUnlocked('garage', r)).toBe(false);
  });
});
