// 順番に進む演出の並び。タップで最後まで一気に飛ばせる。
//   const tl = new Timeline().wait(500).step(300, { start, update: (p) => ..., end });
//   毎フレーム tl.update(dtMs)。tl.finishAll() で残りを全部すぐ終える。

export interface StepHooks {
  start?: () => void;
  /** p は 0〜1 */
  update?: (p: number) => void;
  end?: () => void;
}

interface Step extends StepHooks { ms: number }

export class Timeline {
  private steps: Step[] = [];
  private i = 0;
  private t = 0;
  private started = false;

  get done(): boolean { return this.i >= this.steps.length; }

  wait(ms: number): this { this.steps.push({ ms }); return this; }

  step(ms: number, hooks: StepHooks): this { this.steps.push({ ms, ...hooks }); return this; }

  update(dt: number): void {
    let budget = dt;
    while (!this.done) {
      const s = this.steps[this.i];
      if (!this.started) { this.started = true; this.t = 0; s.start?.(); }
      const left = s.ms - this.t;
      if (budget < left) {
        this.t += budget;
        s.update?.(s.ms > 0 ? this.t / s.ms : 1);
        return;
      }
      budget -= Math.max(0, left);
      s.update?.(1);
      s.end?.();
      this.i++;
      this.started = false;
    }
  }

  finishAll(): void {
    while (!this.done) {
      const s = this.steps[this.i];
      if (!this.started) s.start?.();
      s.update?.(1);
      s.end?.();
      this.i++;
      this.started = false;
    }
  }
}
