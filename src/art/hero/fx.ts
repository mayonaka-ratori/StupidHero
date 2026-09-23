// エフェクト(fx_*)。光は白、薄い黄色、金の3段。半透明は使わない(ゲームで点滅させる)。
import type { PixelGrid } from '../lib';

export type FxMaker = (w: number, h: number, frames: number) => PixelGrid[];

export const FX: Record<string, FxMaker> = {};
