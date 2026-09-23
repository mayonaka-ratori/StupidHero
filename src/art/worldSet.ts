// 担当:市民、悪党、ボス、壊れる物、背景、ロゴ。
// 中身は src/art/world/ の下に分けてある。
import type { ArtContext } from './lib';
import { sheetByKey } from './sheets';
import { buildPeople } from './world/people';
import { buildSheet } from './world/sheet';

export function generateWorldSet(ctx: ArtContext): void {
  const people = buildPeople(ctx.skip);
  for (const [key, rows] of Object.entries(people)) {
    if (ctx.skip.has(key)) continue;
    const def = sheetByKey(key);
    ctx.addSheet(def, buildSheet(def, rows));
  }
}
