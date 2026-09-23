// ボス戦の絵の重なりの順。どれも下の操作部分の背景(900)より小さくする。
export const DEPTH_OF = {
  far: 0,
  wall: 1,
  ground: 2,
  /** 奥の列に止めてある車(柱より奥) */
  propBack: 8,
  /** 女ボスが車に乗ったあと、止めてある高級車の中にいるとき(車より奥) */
  bossInParkedCar: 8.8,
  /** 止めてある女ボスの高級車 */
  parkedCar: 9,
  prop: 10,
  speedLines: 12,
  shadow: 18,
  /** 車に乗った女ボス(車の屋根から上だけ見える) */
  bossInCar: 19,
  boss: 20,
  /** 走り出した女ボスの高級車(ボスより手前、ヒーローより奥) */
  car: 21,
  aura: 29,
  hero: 30,
  fx: 40,
  fxTop: 50
} as const;
