// 曲のデータ。すべてオリジナル。
//
// 書き方:1マス=16分音符。空白で区切る。
//   音の名前(C4, F#3, Bb2 など)=そこで鳴らす   - =前の音をのばす   . =休み
//   ドラムは k=キック s=スネア h=ハイハット o=オープンハット c=クラッシュ T/t/l=タム r=リム を1マスに何個でも(例 "kc")
// トラックの文字列が区間より短いときはくり返す(1小節のドラムを4小節に使い回せる)。
// echo: true のトラックだけ、その曲のエコーに送る(エコーは曲ごと。効果音やほかの曲にはかからない)。

export interface TrackDef {
  inst: string;
  notes: string;
  vol?: number;
  /** その曲のエコーに送る */
  echo?: boolean;
}
/** 曲にかけるエコー(やまびこ) */
export interface EchoDef {
  /** 遅れ(何マスぶん) */
  steps: number;
  /** くり返しの強さ(0〜0.7) */
  feedback: number;
  /** エコーの音の大きさ */
  wet: number;
  /** エコーを丸める周波数(Hz)。低いほど暗く響く */
  damp?: number;
}
export interface SectionDef {
  bars: number;
  tracks: TrackDef[];
}
export interface SongDef {
  bpm: number;
  /** 最初に1回だけ流す部分 */
  intro?: SectionDef;
  /** くり返す部分 */
  loop: SectionDef;
  /** エコー(ステージ2と3の曲だけ) */
  echo?: EchoDef;
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OFFS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C#4" → 61 */
export function midiOf(n: string): number | null {
  const m = /^([A-G])([#b]?)(\d)$/.exec(n);
  if (!m) return null;
  return OFFS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
}
const nameOf = (m: number): string => NAMES[m % 12] + (Math.floor(m / 12) - 1);

/**
 * 1小節の型を根音ごとに並べる。型の中の r=根音 R=1オクターブ上 f=5度上 F=5度+1オクターブ上。
 * 例 bars('r . R .', ['A1', 'F1'])
 */
function bars(template: string, roots: string[]): string {
  const toks = template.trim().split(/\s+/);
  return roots
    .map((root) => {
      const m = midiOf(root) ?? 36;
      return toks.map((tk) => (tk === 'r' ? nameOf(m) : tk === 'R' ? nameOf(m + 12) : tk === 'f' ? nameOf(m + 7) : tk === 'F' ? nameOf(m + 19) : tk)).join(' ');
    })
    .join(' ');
}

/** 和音の音を数字で選んで並べる(0=1番目の音)。和音ごとに1小節 */
function arp(chords: string[], pattern: string): string {
  const toks = pattern.trim().split(/\s+/);
  return chords
    .map((c) => {
      const ns = c.split(/\s+/).map((n) => midiOf(n) ?? 60);
      return toks.map((tk) => (/^\d$/.test(tk) ? nameOf(ns[Number(tk) % ns.length] + 12 * Math.floor(Number(tk) / ns.length)) : tk)).join(' ');
    })
    .join(' ');
}

const rep = (s: string, n: number): string => Array(n).fill(s.trim()).join(' ');

// ================================================================ title
// ハ短調。Cm Ab Bb Cm / Ab Bb G G。ヒーロー登場のブラス。
const TITLE: SongDef = {
  bpm: 152,
  loop: {
    bars: 8,
    tracks: [
      {
        inst: 'brass',
        vol: 1,
        notes: [
          'G4 - - - - - C5 - D5 - Eb5 - - - D5 -',
          'C5 - - - - - Ab4 - - - C5 - Eb5 - - -',
          'D5 - - - F5 - - - Eb5 - D5 - Bb4 - - -',
          'C5 - - - - - - - - - . . G4 - Bb4 B4',
          'C5 - - - Eb5 - - - Ab5 - - - G5 - F5 -',
          'F5 - - - D5 - - - Bb4 - - - D5 - F5 -',
          'G5 - - - - - - - F5 - Eb5 - D5 - - -',
          'B4 - - - D5 - - - G5 - - - - - . .'
        ].join(' ')
      },
      { inst: 'bass', vol: 1, notes: bars('r . R . r . R r . r R . r . R .', ['C2', 'Ab1', 'Bb1', 'C2', 'Ab1', 'Bb1', 'G1', 'G1']) },
      {
        inst: 'sq',
        vol: 0.8,
        notes: arp(['C4 Eb4 G4', 'C4 Eb4 Ab4', 'D4 F4 Bb4', 'C4 Eb4 G4', 'C4 Eb4 Ab4', 'D4 F4 Bb4', 'D4 G4 B4', 'B3 D4 G4'], '0 1 2 3 2 1 0 1 2 3 2 1 0 1 2 3')
      },
      { inst: 'stab', vol: 0.7, notes: bars('r . . . . . . . . . . . . . r .', ['C3', 'Ab2', 'Bb2', 'C3', 'Ab2', 'Bb2', 'G2', 'G2']) },
      {
        inst: 'drums',
        notes: [
          'kc . h . s . h k . k h . s . h h',
          rep('k . h . s . h k . k h . s . h h', 6),
          'k . h . s . h k s . s s T T t l'
        ].join(' ')
      }
    ]
  }
};

// ================================================================ sort
// イ短調。Am Am F E を2回。16分のベースで急かし、はじくリードで少し緊張。
const SORT: SongDef = {
  bpm: 160,
  loop: {
    bars: 8,
    tracks: [
      {
        inst: 'pluck',
        vol: 1,
        notes: [
          'A4 . . C5 . . E5 . D5 . C5 . B4 . . .',
          'C5 . . E5 . . A5 . G#5 - - - E5 - - -',
          'F5 . . E5 . . C5 . A4 - - - C5 . . .',
          'B4 - - - G#4 - - - E4 - - - . . . .',
          'A4 . . C5 . . E5 . A5 . G5 . E5 . . .',
          'F5 . . E5 . . D#5 . E5 - - - . . . .',
          'C6 . . B5 . . A5 . F5 - - - A5 . . .',
          'G#5 - - - B5 - - - E6 - - - D6 . B5 .'
        ].join(' ')
      },
      { inst: 'bass', vol: 0.9, notes: bars('r . r R r . r R r . r R r . R r', ['A1', 'A1', 'F1', 'E1', 'A1', 'A1', 'F1', 'E1']) },
      { inst: 'sq', vol: 0.7, notes: arp(['A4 E5', 'A4 E5', 'A4 C5', 'G#4 B4'], '1 . 0 . 1 . 0 . 1 . 0 . 1 . 0 .') },
      {
        inst: 'drums',
        notes: [rep('k . h h s . h h k . h h s . h h', 3), 'k . h h s . h h k . s . s s s s'].join(' ')
      }
    ]
  }
};

// ================================================================ street
// ヘ長調。F Dm Bb C / F D Gm C。はねるベースと裏打ちのPSGでドタバタ。
const STREET_CHORDS = ['F4 A4 C5', 'D4 F4 A4', 'Bb3 D4 F4', 'C4 E4 G4', 'F4 A4 C5', 'D4 F#4 A4', 'G3 Bb3 D4', 'C4 E4 G4'];
const STREET: SongDef = {
  bpm: 144,
  loop: {
    bars: 8,
    tracks: [
      {
        inst: 'clav',
        vol: 1,
        notes: [
          'C5 . A4 . C5 . F5 . . . E5 . F5 . A5 .',
          'G5 - F5 . D5 . . . F5 . E5 . D5 . A4 .',
          'Bb4 . D5 . F5 . Bb5 - - - A5 . G5 . F5 .',
          'E5 . G5 . C6 - - - Bb5 . G5 . E5 . C5 .',
          'F5 . F5 . A5 . F5 . C6 - - - A5 . . .',
          'F#5 . A5 . F#5 . D5 . C5 - - - A4 . . .',
          'Bb4 . D5 . G5 . Bb5 . A5 . G5 . F5 . D5 .',
          'E5 - - - D5 . E5 . G5 - - - . . . .'
        ].join(' ')
      },
      { inst: 'bass', vol: 1, notes: bars('r . . r R . r . r . . r R . R r', ['F1', 'D2', 'Bb1', 'C2', 'F1', 'D2', 'G1', 'C2']) },
      { inst: 'sq', vol: 0.8, notes: arp(STREET_CHORDS, '. . 1 . . . 1 . . . 1 . . . 1 .') },
      { inst: 'sq', vol: 0.8, notes: arp(STREET_CHORDS, '. . 2 . . . 2 . . . 2 . . . 2 .') },
      { inst: 'drums', notes: [rep('k . h . s . h k . k h . s . h o', 7), 'k . h . s . h k . k s . s s T l'].join(' ') }
    ]
  }
};

// ================================================================ boss
// ニ短調。Dm Dm Eb Eb / Dm Dm Bb A。16分で刻むベースと硬いリード。
const BOSS_ROOTS = ['D2', 'D2', 'Eb2', 'Eb2', 'D2', 'D2', 'Bb1', 'A1'];
const BOSS: SongDef = {
  bpm: 176,
  loop: {
    bars: 8,
    tracks: [
      {
        inst: 'hard',
        vol: 1,
        notes: [
          'D5 . D5 . F5 . D5 . A5 - - - G#5 - A5 -',
          'D6 - - - C6 - A5 - Bb5 - A5 - F5 - E5 -',
          'Eb5 . Eb5 . G5 . Eb5 . Bb5 - - - A5 - Bb5 -',
          'Eb6 - - - D6 - Bb5 - G5 - - - Eb5 - - -',
          'D5 . D5 . F5 . D5 . A5 - - - G#5 - A5 -',
          'F5 - - - E5 - - - D5 - E5 - F5 - G5 -',
          'A5 - - - Bb5 - - - D6 - - - C6 - Bb5 -',
          'A5 - - - C#6 - - - E6 - - - A6 - - -'
        ].join(' ')
      },
      { inst: 'bass', vol: 0.9, notes: bars('r r R r r r R r r r R r R r R r', BOSS_ROOTS) },
      { inst: 'stab', vol: 0.8, notes: bars('R . . . . . . . . . . . R . . .', BOSS_ROOTS) },
      {
        inst: 'sq',
        vol: 0.55,
        notes: arp(['D5 F5 A5', 'D5 F5 A5', 'Eb5 G5 Bb5', 'Eb5 G5 Bb5', 'D5 F5 A5', 'D5 F5 A5', 'D5 F5 Bb5', 'C#5 E5 A5'], '0 1 2 1 0 1 2 1 0 1 2 1 0 1 2 1')
      },
      {
        inst: 'drums',
        notes: ['kc h s h k k s h k h s h k k s h', rep('k h s h k k s h k h s h k k s h', 6), 'k . s s s s T T t t l l kc . kc .'].join(' ')
      }
    ]
  }
};

// ================================================================ result
// ト長調。ファンファーレ2小節のあと、Gmaj7 Em7 Cmaj7 D の落ち着いたループ。
const RESULT: SongDef = {
  bpm: 120,
  intro: {
    bars: 2,
    tracks: [
      { inst: 'brass', vol: 1, notes: 'G4 . G4 . G4 . D5 - - - - - B4 . D5 . G5 - - - - - - - - - - - . . . .' },
      { inst: 'brass', vol: 0.7, notes: 'D4 . D4 . D4 . G4 - - - - - G4 . B4 . D5 - - - - - - - - - - - . . . .' },
      { inst: 'bass', vol: 1, notes: 'G2 . G2 . G2 . G2 - - - - - G2 . G2 . G1 - - - - - - - - - - - . . . .' },
      { inst: 'stab', vol: 0.7, notes: '. . . . . . . . . . . . . . . . G3 . . . . . . . . . . . . . . .' },
      { inst: 'drums', notes: 's . s . s . c . . . . . s . s . kc . . . . . . . . . . . . . . .' }
    ]
  },
  loop: {
    bars: 4,
    tracks: [
      {
        inst: 'bell',
        vol: 1,
        notes: [
          'B4 . D5 . F#5 - - - . . D5 . B4 - - -',
          'G4 - - - B4 . D5 . . . B4 - - - . .',
          'E5 . G5 . B5 - - - . . A5 . G5 - - -',
          'F#5 - - - - - - - E5 . D5 . A4 - - -'
        ].join(' ')
      },
      { inst: 'pad', vol: 1, notes: 'B3 - - - - - - - - - - - - - - - G3 - - - - - - - - - - - - - - - E3 - - - - - - - - - - - - - - - F#3 - - - - - - - - - - - - - - -' },
      { inst: 'pad', vol: 1, notes: 'F#4 - - - - - - - - - - - - - - - D4 - - - - - - - - - - - - - - - B3 - - - - - - - - - - - - - - - C4 - - - - - - - - - - - - - - -' },
      { inst: 'bass', vol: 0.8, notes: bars('r . . . . . R . r . . . R . f .', ['G1', 'E2', 'C2', 'D2']) },
      { inst: 'drums', vol: 0.7, notes: 'k . . . r . . h k . k . r . h .' }
    ]
  }
};

// ================================================================ street2
// ホ短調。Em Em C B / Em Em F B7。夜の地下駐車場の結果発表。
// のびる太いベースとマレットのリードをエコーで響かせ、PSGの裏打ちでドタバタ。Bb(減5度)とF(半音上の和音)で少し不気味に。
// ときどき高い「ピチョン」(天井のしずく)が響く。
const STREET2_ROOTS = ['E1', 'E1', 'C2', 'B1', 'E1', 'E1', 'F1', 'B1'];
const STREET2_CHORDS = ['E4 G4 B4', 'E4 G4 B4', 'C4 E4 G4', 'B3 D#4 F#4', 'E4 G4 B4', 'E4 G4 Bb4', 'F4 A4 C5', 'B3 D#4 A4'];
const STREET2: SongDef = {
  bpm: 138,
  echo: { steps: 3, feedback: 0.42, wet: 0.4, damp: 1800 },
  loop: {
    bars: 8,
    tracks: [
      {
        inst: 'mallet',
        vol: 0.9,
        echo: true,
        notes: [
          'E4 . . G4 . . Bb4 . A4 . . . G4 . E4 .',
          'F#4 - - - G4 . F#4 . E4 - - - . . B3 .',
          'C5 . . B4 . . G4 . E4 . . . G4 . C5 .',
          'B4 - - - D#5 - - - F#5 - - - . . . .',
          'E5 . . D5 . . Bb4 . B4 . . . G4 . E4 .',
          'G4 . A4 . Bb4 . B4 . D5 - - - B4 . . .',
          'F5 . . E5 . . C5 . A4 . . . F4 . A4 .',
          'D#5 - - - F#5 - - - A4 . B4 . . . . .'
        ].join(' ')
      },
      { inst: 'deep', vol: 1, echo: true, notes: bars('r . . r . . R . r . . r R . f .', STREET2_ROOTS) },
      { inst: 'sq', vol: 0.8, notes: arp(STREET2_CHORDS, '. . 0 . . . 1 . . . 0 . . 2 . .') },
      // しずく:4小節に1回
      { inst: 'sq', vol: 0.6, echo: true, notes: [rep('.', 30), 'B6', rep('.', 33)].join(' ') },
      { inst: 'drums', notes: [rep('k . . k s . h . k . k . s . h h', 7), 'k . . k s . s . k . T . t . l l'].join(' ') },
      // 響くリム
      { inst: 'drums', vol: 0.6, echo: true, notes: '. . . . . . . . . . . . . . . r' }
    ]
  }
};

// ================================================================ boss2
// ト短調。Gm Gm Eb F / Gm Gm Eb D。女ボスとのカーチェイス。
// 16分で走るベースと、うっすらエコーのかかった硬いリード。
const BOSS2_ROOTS = ['G1', 'G1', 'Eb2', 'F2', 'G1', 'G1', 'Eb2', 'D2'];
const BOSS2: SongDef = {
  bpm: 184,
  echo: { steps: 3, feedback: 0.25, wet: 0.22, damp: 3000 },
  loop: {
    bars: 8,
    tracks: [
      {
        inst: 'hard',
        vol: 1,
        echo: true,
        notes: [
          'G5 - - - D5 - G5 - Bb5 - A5 - G5 - D5 -',
          'F5 - G5 - - - D5 . Bb4 . C5 . D5 - - -',
          'Eb5 - - - Bb4 - Eb5 - G5 - F5 - Eb5 - Bb4 -',
          'C5 - D5 - Eb5 - F5 - A5 - - - F5 - - -',
          'G5 - - - D5 - G5 - Bb5 - A5 - G5 - D6 -',
          'D6 - C6 - Bb5 - A5 - G5 - - - Bb5 - A5 -',
          'G5 - - - Eb5 - G5 - Bb5 - - - C6 - Bb5 -',
          'A5 - - - F#5 - - - D5 - F#5 - A5 - C6 -'
        ].join(' ')
      },
      { inst: 'bass', vol: 0.9, notes: bars('r r R r r r R r r r R r r R f R', BOSS2_ROOTS) },
      { inst: 'stab', vol: 0.75, notes: bars('R . . R . . R . . . R . . . . .', BOSS2_ROOTS) },
      {
        inst: 'sq',
        vol: 0.5,
        notes: arp(['G5 Bb5 D6', 'G5 Bb5 D6', 'G5 Bb5 Eb6', 'F5 A5 C6', 'G5 Bb5 D6', 'G5 Bb5 D6', 'G5 Bb5 Eb6', 'F#5 A5 D6'], '2 1 0 1 2 1 0 1 2 1 0 1 2 1 0 1')
      },
      {
        inst: 'drums',
        notes: ['kc h s h k h s k h k s h k h s o', rep('k h s h k h s k h k s h k h s h', 6), 'k . s s T T t t l l s s kc . kc .'].join(' ')
      }
    ]
  }
};

// ================================================================ street3
// ヘ長調。F Dm Gm C / F A7 Bb Db。夜のショッピングモールの結果発表。
// 店内放送のようなエレピとボサノバ風のベースに、テルミン風の音と宇宙っぽいパッドをふわふわ重ねる。
// 最後の Db(半音上のほうにずれた和音)で少しだけ「よその星」っぽくして頭に戻る。
const STREET3_ROOTS = ['F1', 'D2', 'G1', 'C2', 'F1', 'A1', 'Bb1', 'Db2'];
const STREET3_CHORDS = ['F4 A4 C5', 'D4 F4 A4', 'G4 Bb4 D5', 'E4 G4 C5', 'F4 A4 C5', 'E4 G4 C#5', 'F4 Bb4 D5', 'F4 Ab4 Db5'];
/** 和音ごとに1小節のばす(パッド用)。n は和音の何番目の音か */
const holds = (chords: string[], n: number): string => chords.map((c) => [c.split(/\s+/)[n], rep('-', 15)].join(' ')).join(' ');
const STREET3: SongDef = {
  bpm: 128,
  echo: { steps: 3, feedback: 0.3, wet: 0.3, damp: 2800 },
  loop: {
    bars: 8,
    tracks: [
      {
        inst: 'bell',
        vol: 1,
        notes: [
          'A4 . C5 . F5 - - E5 . . F5 . A5 - - -',
          'G5 . F5 . D5 - - - . . A4 . D5 . F5 .',
          'E5 . D5 . Bb4 - - - D5 . G5 - - - F5 .',
          'E5 - - - C5 . . . G4 - - - . . . .',
          'A4 . C5 . F5 - - E5 . . F5 . C6 - - -',
          'C#6 . A5 . E5 - - - G5 . E5 . C#5 - - -',
          'D5 . F5 . Bb5 - - A5 . . G5 . F5 - - -',
          'Ab5 - - - F5 - - - Db5 - - - C5 - - -'
        ].join(' ')
      },
      // テルミン風:のばす音でゆったり追いかける
      {
        inst: 'theremin',
        vol: 0.8,
        echo: true,
        notes: [
          'C5 - - - - - - - - - - - A4 - - -',
          'A4 - - - - - - - F4 - - - - - - -',
          'Bb4 - - - - - - - D5 - - - - - - -',
          'C5 - - - - - - - - - - - E5 - - -',
          'C5 - - - - - - - A4 - - - - - - -',
          'C#5 - - - - - - - - - - - E5 - - -',
          'D5 - - - - - - - - - - - F5 - - -',
          'Ab4 - - - - - - - - - - - G4 - - -'
        ].join(' ')
      },
      { inst: 'space', vol: 0.9, notes: holds(STREET3_CHORDS, 0) },
      { inst: 'space', vol: 0.9, notes: holds(STREET3_CHORDS, 2) },
      { inst: 'bass', vol: 0.85, notes: bars('r . . r f . . r R . . r f . r .', STREET3_ROOTS) },
      { inst: 'sq', vol: 0.7, notes: arp(STREET3_CHORDS, '. . 1 . . . 2 . . . 1 . . 2 . .') },
      // 星のきらめき:4小節に1回、上がる4つの音がエコーで響く
      { inst: 'sq', vol: 0.5, echo: true, notes: [rep('.', 56), 'F5 . A5 . C6 . F6 .'].join(' ') },
      { inst: 'drums', vol: 0.75, notes: [rep('k . h . r . h h k . h . r . h .', 7), 'k . h . r . h h k . k . r . o .'].join(' ') }
    ]
  }
};

// ================================================================ boss3
// イ短調。Am Am F G / Am Am Bb E。宇宙人の親玉と母艦とのボス戦。
// 16分で走るベースと、エコーのかかった硬いリード。うしろでテルミン風の音がうなり、
// 最後の小節は全音音階で下りてくる(宇宙人っぽい、落ちつかない音の並び)。
const BOSS3_ROOTS = ['A1', 'A1', 'F1', 'G1', 'A1', 'A1', 'Bb1', 'E2'];
const BOSS3: SongDef = {
  bpm: 180,
  echo: { steps: 3, feedback: 0.25, wet: 0.2, damp: 3000 },
  loop: {
    bars: 8,
    tracks: [
      {
        inst: 'hard',
        vol: 1,
        echo: true,
        notes: [
          'A5 - - - E5 - A5 - C6 - B5 - A5 - E5 -',
          'G5 - A5 - - - E5 . C5 . D5 . E5 - - -',
          'F5 - - - C5 - F5 - A5 - G5 - F5 - C5 -',
          'D5 - E5 - F5 - G5 - B5 - - - G5 - - -',
          'A5 - - - E5 - A5 - C6 - B5 - A5 - E6 -',
          'E6 - D6 - C6 - B5 - A5 - - - C6 - B5 -',
          'Bb5 - - - F5 - Bb5 - D6 - - - C6 - Bb5 -',
          'E6 - D6 - C6 - Bb5 - G#5 - F#5 - E5 - G#5 -'
        ].join(' ')
      },
      { inst: 'theremin', vol: 0.55, echo: true, notes: ['E5', rep('-', 31), 'F5', rep('-', 15), 'D5', rep('-', 15), 'E5', rep('-', 31), 'F5', rep('-', 15), 'E5', rep('-', 15)].join(' ') },
      { inst: 'bass', vol: 0.9, notes: bars('r r R r r R r r r r R r R r f R', BOSS3_ROOTS) },
      { inst: 'stab', vol: 0.75, notes: bars('R . . . . . R . . . R . . . . .', BOSS3_ROOTS) },
      {
        inst: 'sq',
        vol: 0.5,
        notes: arp(['A4 C5 E5', 'A4 C5 E5', 'A4 C5 F5', 'B4 D5 G5', 'A4 C5 E5', 'A4 C5 E5', 'Bb4 D5 F5', 'G#4 B4 E5'], '0 1 2 1 0 1 2 1 0 1 2 1 0 1 2 1')
      },
      {
        inst: 'drums',
        notes: ['kc h s h k h s k h k s h k h s o', rep('k h s h k h s k h k s h k h s h', 6), 'k . s s T T t t l l s s kc . kc .'].join(' ')
      }
    ]
  }
};

// ================================================================ sale3
// ニ長調。D Bm G A。タイムセールラッシュ(約16秒)の曲。
// 「ジャン・ジャン!」の1小節のあと、4小節(約5.7秒)のループを何度か回す。
// 安売りの呼びこみのように、ブラスが短く何度も呼びかけ、オクターブで跳ねるベースと裏打ちのハイハットで急かす。
const SALE3_ROOTS = ['D2', 'B1', 'G1', 'A1'];
const SALE3_CHORDS = ['D4 F#4 A4', 'D4 F#4 B4', 'D4 G4 B4', 'C#4 E4 A4'];
const SALE3: SongDef = {
  bpm: 168,
  intro: {
    bars: 1,
    tracks: [
      { inst: 'brass', vol: 1, notes: 'D5 . . . D5 . . . . . . . A4 . C#5 .' },
      { inst: 'stab', vol: 0.8, notes: 'D3 . . . D3 . . . . . . . . . . .' },
      { inst: 'bass', vol: 1, notes: 'D2 . . . D2 . . . . . . . A1 . C#2 .' },
      { inst: 'drums', notes: 'kc . . . kc . . . . . s . s s s s' }
    ]
  },
  loop: {
    bars: 4,
    tracks: [
      {
        inst: 'brass',
        vol: 1,
        notes: [
          'A4 . A4 . D5 . A4 . F#5 - - . E5 . D5 .',
          'F#5 . F#5 . D5 . B4 . D5 - - - . . . .',
          'G5 . G5 . B5 . G5 . A5 - - . G5 . F#5 .',
          'E5 - - - A5 - - - C#6 . B5 . A5 . E5 .'
        ].join(' ')
      },
      // 呼びかけへの合いの手
      { inst: 'bell', vol: 0.8, notes: [rep('.', 28), 'A5 . B5 . D6', rep('-', 3), rep('.', 28)].join(' ') },
      { inst: 'bass', vol: 0.9, notes: bars('r . R . r . R . r . R . r . R f', SALE3_ROOTS) },
      { inst: 'sq', vol: 0.75, notes: arp(SALE3_CHORDS, '. . 1 . . . 2 . . . 1 . . . 2 .') },
      { inst: 'sq', vol: 0.75, notes: arp(SALE3_CHORDS, '. . 2 . . . 0 . . . 2 . . . 0 .') },
      { inst: 'stab', vol: 0.6, notes: bars('R . . . . . . . . . . . . . . .', SALE3_ROOTS) },
      { inst: 'drums', notes: [rep('k . h o s . h o k . h o s . h o', 3), 'k . h o s . h o k . s . s s s s'].join(' ') }
    ]
  }
};

// ================================================================ free1 / free2 / free3
// ト長調。G E7 Am D7 / G B7 Em C / G E7 Am D7 / C Cm G D7。フリープレイ(ヒーローのおバカな決めつけ)の曲。
// ブンチャッ(1・3拍に低いベース、2・4拍にブラスの和音)の楽隊のノリに、鼻にかかったラッパ風のリードが
// 半音下からすくい上げて跳ね回る。ポクッという木魚、スライドホイッスル、半音でくねる節、
// 14小節目の Cm(「おっと」の和音)で少しとぼける。最後の C#5 から頭の D5 へ半音で戻る。
// 同じ曲を波ごとに少しずつ速くする(free1 → free2 → free3。テンポだけ変える)。
const FREE_ROOTS = ['G1', 'E1', 'A1', 'D2', 'G1', 'B1', 'E1', 'C2', 'G1', 'E1', 'A1', 'D2', 'C2', 'C2', 'G1', 'D2'];
const FREE_CHORDS = [
  'B3 D4 G4', 'B3 D4 G#4', 'C4 E4 A4', 'C4 F#4 A4', 'B3 D4 G4', 'A3 D#4 F#4', 'B3 E4 G4', 'C4 E4 G4',
  'B3 D4 G4', 'B3 D4 G#4', 'C4 E4 A4', 'C4 F#4 A4', 'C4 E4 G4', 'C4 Eb4 G4', 'B3 D4 G4', 'C4 F#4 A4'
];
const FREE_BEAT = 'k . h . s . h b k . h . s b h .';
const FREE1: SongDef = {
  bpm: 150,
  loop: {
    bars: 16,
    tracks: [
      {
        inst: 'toot',
        vol: 1.1,
        notes: [
          'D5 . . B4 . . G4 . A4 . B4 . D5 . . .',
          'E5 . G#4 . B4 . E5 . D5 - - - . . . .',
          'C5 . . A4 . . E4 . G#4 . A4 . C5 . E5 .',
          'D5 - C5 . A4 . F#4 . D4 . . . . . . .',
          'D5 . . B4 . . G4 . A4 . B4 . D5 . G5 .',
          'F#5 . D#5 . B4 . D#5 . F#5 - - - A5 - - -',
          'G5 . . F#5 . . E5 . B4 . . . E5 . G5 .',
          'E5 . . C5 . . G4 . A4 - - - . . . .',
          // 半音でくねる、とぼけた節(2小節ずらして同じ形)
          'B4 . B4 . C5 . B4 . A#4 B4 . . G4 . . .',
          'G#4 . G#4 . A4 . G#4 . G4 G#4 . . E4 . . .',
          'A4 . C5 . E5 . A5 . G#5 . A5 . E5 . C5 .',
          'D5 . F#5 . A5 . C6 . B5 . A5 . F#5 . D5 .',
          'E5 - - - G5 . E5 . C5 - - - . . . .',
          'Eb5 - - - G5 . Eb5 . C5 - - - . . . .',
          'D5 . B4 . G4 . D5 . B4 . G4 . D4 . . .',
          'C5 . . . A4 . . . F#4 . A4 . C5 . C#5 .'
        ].join(' ')
      },
      // 合いの手:リードが休むところでスライドホイッスル(ヒューイッ)とベル
      {
        inst: 'slide',
        vol: 0.9,
        notes: [rep('.', 58), 'D5 - - - - -', rep('.', 60), 'G5 - - -', rep('.', 128)].join(' ')
      },
      {
        inst: 'bell',
        vol: 0.6,
        notes: [rep('.', 204), 'G5 . C6 .', rep('.', 12), 'G5 . Eb6 .', rep('.', 32)].join(' ')
      },
      { inst: 'bass', vol: 1.05, notes: bars('r . . . f . . . r . . . f . r .', FREE_ROOTS) },
      // ブンチャッの「チャッ」(2拍目と4拍目)
      { inst: 'brass', vol: 0.48, notes: arp(FREE_CHORDS, '. . . . 1 . . . . . . . 1 . . .') },
      { inst: 'brass', vol: 0.48, notes: arp(FREE_CHORDS, '. . . . 2 . . . . . . . 2 . . .') },
      { inst: 'sq', vol: 0.55, notes: arp(FREE_CHORDS, '. . 5 . . . . . . . 5 . . . 3 .') },
      {
        inst: 'drums',
        notes: [
          'kc . h . s . h b k . h . s b h .',
          rep(FREE_BEAT, 6),
          'k . h . s . h b k . s s T . t .',
          'kc . h . s . h b k . h . s b h .',
          rep(FREE_BEAT, 6),
          'k . h b s . b b s s s s T t l l'
        ].join(' ')
      }
    ]
  }
};
/** 波2:少し速く */
const FREE2: SongDef = { ...FREE1, bpm: 158 };
/** 波3:さらに少し速く */
const FREE3: SongDef = { ...FREE1, bpm: 166 };

export const SONGS = {
  title: TITLE, sort: SORT, street: STREET, boss: BOSS, result: RESULT, street2: STREET2, boss2: BOSS2,
  street3: STREET3, boss3: BOSS3, sale3: SALE3,
  free1: FREE1, free2: FREE2, free3: FREE3
} as const;
