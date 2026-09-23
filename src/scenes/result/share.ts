// 共有の流れ。
// 1. 共有メニューが使えるとき(navigator.canShare({ files }) が true):navigator.share({ files, text }) を
//    タップの処理の中ですぐ呼ぶ。キャンセルされたら何もしない
// 2. 使えないとき、失敗したとき:ゲームの上にHTMLで重ねて、画像を大きく出し「長押しで写真に保存」。
//    その下に「Xに投稿」と「とじる」
//
// iPhoneのSafariでは、指が離れたとき(touchend)でないと共有メニューが開かない。
// そこで、ゲームのボタンは指が触れた瞬間に「共有するつもり」を覚えておき(arm)、
// 指が離れたときのブラウザのイベントの中で共有を始める。
//   const sh = new ShareFlow({ text, getFile: () => file, dataUrl, onOpen, onClose });
//   button.on('press', () => sh.arm());
//   sh.destroy();   // シーンが終わるとき

import { xPostUrl } from '../../logic';
import { FONT_FAMILY } from '../../config';

export interface ShareFlowOptions {
  text: string;
  /** 共有する PNG(まだできていなければ null) */
  getFile: () => File | null;
  /** 重ねて出す画像 */
  getDataUrl: () => string;
  /** 重ねて出したとき、とじたとき(ゲームのタップを止めるため) */
  onOpen?: () => void;
  onClose?: () => void;
  /** 共有メニューを開いた、キャンセルされた、などを知らせる(開発用) */
  log?: (s: string) => void;
}

export class ShareFlow {
  private armed = false;
  private armedAt = 0;
  private overlay: HTMLDivElement | null = null;
  private busy = false;
  private readonly onUp = (e: Event): void => {
    if (!this.armed) return;
    // 押してから時間がたちすぎた指は数えない(ほかのところで離しただけのとき)
    if (performance.now() - this.armedAt > 4000) { this.armed = false; return; }
    this.armed = false;
    this.opt.log?.(`up:${e.type}`);
    this.start();
  };

  constructor(private opt: ShareFlowOptions) {
    window.addEventListener('touchend', this.onUp, true);
    window.addEventListener('mouseup', this.onUp, true);
    window.addEventListener('pointerup', this.onUpPointer, true);
  }

  /** マウスのときは mouseup で、指のときは touchend で始める(pointerup は指以外のペンなど) */
  private readonly onUpPointer = (e: PointerEvent): void => {
    if (e.pointerType === 'pen') this.onUp(e);
  };

  /** ゲームのボタンが押された(指が触れた)。次に指が離れたときに共有を始める */
  arm(): void {
    this.armed = true;
    this.armedAt = performance.now();
  }

  get isOpen(): boolean { return this.overlay !== null; }

  /** 共有を始める。ユーザーの操作(指が離れた、クリック)の中で呼ぶこと */
  start(): void {
    if (this.busy || this.overlay) return;
    const file = this.opt.getFile();
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    let can = false;
    try { can = !!file && typeof nav.share === 'function' && !!nav.canShare?.({ files: [file] }); } catch { can = false; }
    if (!can || !file) { this.opt.log?.('fallback'); this.showOverlay(); return; }
    this.busy = true;
    this.opt.log?.('share');
    let p: Promise<void>;
    try {
      p = nav.share({ files: [file], text: this.opt.text });
    } catch (err) {
      this.busy = false;
      this.opt.log?.(`share-throw:${(err as Error)?.name}`);
      this.showOverlay();
      return;
    }
    p.then(
      () => { this.busy = false; this.opt.log?.('shared'); },
      (err: unknown) => {
        this.busy = false;
        const name = (err as Error)?.name;
        this.opt.log?.(`share-error:${name}`);
        // キャンセルされたときは何もしない(ゲームはそのまま)
        if (name === 'AbortError') return;
        this.showOverlay();
      }
    );
  }

  /** 画像を大きく出す(長押しで写真に保存) */
  showOverlay(): void {
    if (this.overlay) return;
    const o = document.createElement('div');
    o.id = 'share-overlay';
    const font = `"${FONT_FAMILY}", monospace`;
    Object.assign(o.style, {
      position: 'fixed', inset: '0', zIndex: '9', background: '#0e0c1a', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px 12px calc(12px + env(safe-area-inset-bottom, 0px))',
      boxSizing: 'border-box', fontFamily: font, color: '#ffffff', touchAction: 'auto'
    } as Partial<CSSStyleDeclaration>);

    const img = document.createElement('img');
    img.src = this.opt.getDataUrl();
    img.alt = 'Stupid Hero の結果';
    Object.assign(img.style, {
      display: 'block', width: 'auto', height: 'auto', maxWidth: '92vw', maxHeight: 'calc(100% - 150px)',
      aspectRatio: '1080 / 1350', imageRendering: 'pixelated', border: '2px solid #e8ecff', boxSizing: 'border-box',
      touchAction: 'auto', pointerEvents: 'auto', userSelect: 'auto'
    } as Partial<CSSStyleDeclaration>);
    // 長押しの保存メニューを出せるように(ページ全体では止めてある)
    img.style.setProperty('-webkit-touch-callout', 'default');
    img.style.setProperty('-webkit-user-select', 'auto');

    const hint = document.createElement('div');
    hint.textContent = '長押しで写真に保存';
    Object.assign(hint.style, { fontSize: '20px', color: '#ffd35a', letterSpacing: '1px' });

    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', gap: '12px' });
    const btn = (label: string, bg: string, fg: string, shade: string): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      Object.assign(b.style, {
        fontFamily: font, fontSize: '20px', padding: '10px 18px', minWidth: '132px', color: fg, background: bg,
        border: '2px solid #ffffff', outline: '2px solid #000000', borderRadius: '0', boxShadow: `inset 0 -4px 0 ${shade}`,
        touchAction: 'manipulation', cursor: 'pointer'
      } as Partial<CSSStyleDeclaration>);
      return b;
    };
    const x = btn('Xに投稿', '#1d1d1d', '#ffffff', '#000000');
    x.addEventListener('click', () => {
      this.opt.log?.('x');
      window.open(xPostUrl(this.opt.text), '_blank', 'noopener');
    });
    const close = btn('とじる', '#4a3f78', '#ffffff', '#2e2750');
    close.addEventListener('click', () => this.closeOverlay());
    row.append(x, close);

    const note = document.createElement('div');
    note.textContent = 'ホーム画面に追加すると記録が消えにくいよ';
    Object.assign(note.style, { fontSize: '13px', color: '#c8c0e0' });

    o.append(img, hint, row, note);
    // ゲームにタップが届かないように
    for (const t of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'touchmove', 'mousedown', 'mouseup']) o.addEventListener(t, (e) => e.stopPropagation());
    document.body.appendChild(o);
    this.overlay = o;
    this.opt.onOpen?.();
  }

  closeOverlay(): void {
    if (!this.overlay) return;
    this.overlay.remove();
    this.overlay = null;
    this.opt.log?.('close');
    this.opt.onClose?.();
  }

  destroy(): void {
    window.removeEventListener('touchend', this.onUp, true);
    window.removeEventListener('mouseup', this.onUp, true);
    window.removeEventListener('pointerup', this.onUpPointer, true);
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
  }
}
