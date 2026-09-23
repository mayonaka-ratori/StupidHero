// 結果画面からステージを選ぶ画面へ渡す「今回のプレイで開いたステージ」。
//   markJustUnlocked(this, saved.unlockedNow);   // 結果画面で(開いたステージがあれば)
//   const ids = takeJustUnlocked(this);          // ステージを選ぶ画面で。鍵がこわれる演出をして、印を消す
// scene.registry に入れるので、ページを開き直すと消える(そのときは「NEW」の札だけ出る)。

import type Phaser from 'phaser';
import type { StageId } from '../../logic';

const KEY = 'justUnlocked';

export function markJustUnlocked(scene: Phaser.Scene, ids: readonly StageId[]): void {
  if (ids.length === 0) return;
  const now = (scene.registry.get(KEY) as StageId[] | undefined) ?? [];
  scene.registry.set(KEY, [...now, ...ids.filter((id) => !now.includes(id))]);
}

export function takeJustUnlocked(scene: Phaser.Scene): StageId[] {
  const ids = (scene.registry.get(KEY) as StageId[] | undefined) ?? [];
  scene.registry.set(KEY, []);
  return ids;
}
