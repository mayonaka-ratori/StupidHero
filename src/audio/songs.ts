// 曲のデータ。すべてオリジナル。
//
// 書き方:1マス=16分音符。空白で区切る。
//   音の名前(C4, F#3, Bb2 など)=そこで鳴らす   - =前の音をのばす   . =休み
//   ドラムは k=キック s=スネア h=ハイハット o=オープンハット c=クラッシュ T/t/l=タム r=リム を1マスに何個でも(例 "kc")
// トラックの文字列が区間より短いときはくり返す(1小節のドラムを4小節に使い回せる)。

export interface TrackDef {
  inst: string;
  notes: string;
  vol?: number;
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

export const SONGS = { title: TITLE, sort: SORT, street: STREET, boss: BOSS, result: RESULT } as const;
