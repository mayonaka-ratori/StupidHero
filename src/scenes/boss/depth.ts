// ボス戦の絵の重なりの順。どれも下の操作部分の背景(900)より小さくする。
export const DEPTH_OF = {
  far: 0,
  wall: 1,
  ground: 2,
  prop: 10,
  speedLines: 12,
  shadow: 18,
  boss: 20,
  aura: 29,
  hero: 30,
  fx: 40,
  fxTop: 50
} as const;
