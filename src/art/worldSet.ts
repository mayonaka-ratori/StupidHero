// 担当:市民、悪党、ボス、壊れる物、背景、ロゴ。
// 中身は src/art/world/ の下に分けてある。
import { type ArtContext, createCanvas, type PixelGrid } from './lib';
import { IMAGES, sheetByKey } from './sheets';
import { drawFar, drawGround, drawWall } from './world/backgrounds';
import { drawLogo } from './world/logo';
import { buildBoss } from './world/boss';
import { buildPeople } from './world/people';
import { buildProps } from './world/props';
import { buildSheet } from './world/sheet';

export function generateWorldSet(ctx: ArtContext): void {
  const sheets = { ...buildPeople(ctx.skip), ...buildProps() };
  for (const [key, rows] of Object.entries(sheets)) {
    if (ctx.skip.has(key)) continue;
    const def = sheetByKey(key);
    ctx.addSheet(def, buildSheet(def, rows));
  }
  const images: Record<string, () => PixelGrid> = { bg_alley_far: drawFar, bg_alley_wall: drawWall, bg_alley_ground: drawGround, logo: drawLogo };
  for (const [key, draw] of Object.entries(images)) {
    if (ctx.skip.has(key)) continue;
    const def = IMAGES.find((d) => d.key === key)!;
    const g = draw();
    const { canvas, ctx: c } = createCanvas(def.w, def.h);
    g.drawTo(c, 0, 0);
    ctx.addImage(def, canvas);
  }
  if (!ctx.skip.has('boss')) {
    const def = sheetByKey('boss');
    ctx.addSheet(def, buildSheet(def, buildBoss()));
  }
}
