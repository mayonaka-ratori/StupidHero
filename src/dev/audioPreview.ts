// 曲と効果音を1つずつ鳴らすための開発用ページ(/dev/audio.html)。ゲームには入らない。
// 「数字で確かめる」を押すと、OfflineAudioContext で描き出して最大音量などを表にする。
// tools/audioCheck.mjs からは window.__audioCheck() を呼ぶ。
import { type BgmName, type SfxName, audio } from '../audio';
import type { Engine } from '../audio/engine';
import {
  BGM_NAMES,
  SFX_NAMES,
  type Level,
  analyze,
  backlogSteps,
  renderBgm,
  renderSfx,
  renderSfxRepeat,
  renderWorstCase,
  renderWorstCaseBoss2,
  renderWorstCaseBoss3,
  renderWorstCaseFree,
  renderWorstCaseSale3,
  renderWorstCaseStreet2,
  renderWorstCaseStreet3,
  SFX_START,
  songSeconds
} from '../audio/offline';

/** ステージ2で足した効果音(何度も続けて鳴らしたときの大きさも測る) */
const STAGE2_SFX: SfxName[] = ['whistle', 'engine', 'skid', 'horn', 'crash'];
/** ステージ3で足した効果音のうち、何度も続けて鳴らすもの */
const STAGE3_SFX: SfxName[] = ['tractor', 'shipBeam', 'beep', 'glitch'];
/** フリープレイで足した効果音(空押しは何度も鳴る) */
const FREE_SFX: SfxName[] = ['declareBad', 'declarePass', 'dryPress'];

const engine = audio as unknown as Engine;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', parent: HTMLElement = document.body): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.textContent = text;
  parent.appendChild(e);
  return e;
};

el('h2', '状態');
const state = el('div');
state.id = 'state';
const showState = () => {
  state.textContent = JSON.stringify(engine.debug());
};
setInterval(showState, 250);

// どこを押しても最初に unlock する(ゲームと同じ)
document.addEventListener('pointerdown', () => audio.unlock(), { capture: true });

el('h2', 'BGM');
const bgmRow = el('div');
for (const n of BGM_NAMES) el('button', n, bgmRow).onclick = () => audio.playBgm(n as BgmName);
el('button', '止める', bgmRow).onclick = () => audio.stopBgm(600);
const muteBtn = el('button', '', bgmRow);
const showMute = () => {
  muteBtn.textContent = audio.isMuted() ? '音:オフ' : '音:オン';
  muteBtn.className = audio.isMuted() ? 'on' : '';
};
muteBtn.onclick = () => {
  audio.toggleMuted();
  showMute();
};
showMute();

el('h2', '効果音');
const pitchRow = el('div');
el('span', '音程 ', pitchRow);
const pitch = el('input', '', pitchRow);
pitch.type = 'range';
pitch.min = '0.5';
pitch.max = '2';
pitch.step = '0.05';
pitch.value = '1';
const pitchLabel = el('span', ' 1.00', pitchRow);
pitch.oninput = () => (pitchLabel.textContent = ' ' + Number(pitch.value).toFixed(2));
const sfxRow = el('div');
for (const n of SFX_NAMES) el('button', n, sfxRow).onclick = () => audio.sfx(n, { pitch: Number(pitch.value) });

el('h2', '数字で確かめる');
const checkBtn = el('button', '描き出して測る');
const out = el('div');

interface Row {
  kind: string;
  name: string;
  final: Level;
  raw: Level;
}

async function check(): Promise<{ rows: Row[]; backlog: number }> {
  const rows: Row[] = [];
  for (const n of BGM_NAMES) {
    // 前奏とくり返し1回ぶん + 2秒(くり返しのつなぎ目とエコーの残りまで)
    const sec = Math.ceil(songSeconds(n)) + 2;
    rows.push({ kind: 'bgm', name: n, final: analyze(await renderBgm(n, sec)), raw: analyze(await renderBgm(n, sec, false)) });
  }
  for (const n of SFX_NAMES) {
    rows.push({ kind: 'sfx', name: n, final: analyze(await renderSfx(n as SfxName), SFX_START), raw: analyze(await renderSfx(n as SfxName, false), SFX_START) });
  }
  for (const n of [...STAGE2_SFX, ...STAGE3_SFX, ...FREE_SFX]) {
    rows.push({ kind: 'rep', name: n + '×', final: analyze(await renderSfxRepeat(n), SFX_START), raw: analyze(await renderSfxRepeat(n, false), SFX_START) });
  }
  rows.push({ kind: 'mix', name: 'boss+sfx', final: analyze(await renderWorstCase()), raw: analyze(await renderWorstCase(false)) });
  rows.push({ kind: 'mix', name: 'boss2+sfx', final: analyze(await renderWorstCaseBoss2()), raw: analyze(await renderWorstCaseBoss2(false)) });
  rows.push({ kind: 'mix', name: 'street2+sfx', final: analyze(await renderWorstCaseStreet2()), raw: analyze(await renderWorstCaseStreet2(false)) });
  rows.push({ kind: 'mix', name: 'boss3+sfx', final: analyze(await renderWorstCaseBoss3()), raw: analyze(await renderWorstCaseBoss3(false)) });
  rows.push({ kind: 'mix', name: 'street3+sfx', final: analyze(await renderWorstCaseStreet3()), raw: analyze(await renderWorstCaseStreet3(false)) });
  rows.push({ kind: 'mix', name: 'sale3+sfx', final: analyze(await renderWorstCaseSale3()), raw: analyze(await renderWorstCaseSale3(false)) });
  rows.push({ kind: 'mix', name: 'free3+sfx', final: analyze(await renderWorstCaseFree()), raw: analyze(await renderWorstCaseFree(false)) });
  return { rows, backlog: backlogSteps() };
}

function table(res: { rows: Row[]; backlog: number }): void {
  out.textContent = '';
  const t = el('table', '', out);
  const h = el('tr', '', t);
  for (const s of ['種類', '名前', '最大', '平均dB', '音の長さ秒', '制限前の最大']) el('th', s, h);
  for (const r of res.rows) {
    const tr = el('tr', '', t);
    el('td', r.kind, tr);
    el('td', r.name, tr);
    const pk = el('td', r.final.peak.toFixed(3), tr);
    if (r.final.peak > 1 || r.final.peak < 0.01) pk.className = 'ng';
    el('td', r.final.rmsDb.toFixed(1), tr);
    el('td', r.final.lastSound.toFixed(2), tr);
    el('td', r.raw.peak.toFixed(3), tr);
  }
  el('div', `遅れたときに一度に予約したマス: ${res.backlog}`, out);
}

checkBtn.onclick = async () => {
  checkBtn.disabled = true;
  out.textContent = '描き出し中…';
  table(await check());
  checkBtn.disabled = false;
};

declare global {
  interface Window {
    __audioCheck: typeof check;
    __audio: typeof audio;
    __audioDebug: () => ReturnType<Engine['debug']>;
  }
}
window.__audioCheck = check;
window.__audio = audio;
window.__audioDebug = () => engine.debug();
