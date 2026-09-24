// 開発のダッシュボードを作る。gitの記録、テスト、型の確かめ、docs/BOARD.md(やることと質問)を読んで、
// スマホでも見やすい1枚のHTMLにまとめる。開発用のサーバーはいらない。
//
// 使い方:
//   node tools/dashboard.mjs              # テストと型の確かめも動かす(1分くらい)
//   node tools/dashboard.mjs --quick      # テストと型の確かめをとばす
//   node tools/dashboard.mjs - out.html   # 書き出す場所を変える(ふつうは dashboard/index.html。gitに入れない)
//
// 出したHTMLは、そのままブラウザで開ける。Claude Codeのセッションでは、Artifactとして公開すればスマホで見られる。
// やることと質問は docs/BOARD.md の表から読む。表の形を変えたら、下の readBoard も合わせる。

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
const quick = args.includes('--quick');
const outArg = args.filter((a) => !a.startsWith('--'))[1];
const outFile = outArg && outArg !== '-' ? outArg : 'dashboard/index.html';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const lines = (s) => (s ? s.split('\n') : []);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---- git ----

const head = git('rev-parse', '--short', 'HEAD');
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
const SEP = '\x1f';
const commits = lines(git('log', '--no-merges', `--format=%h${SEP}%an${SEP}%aI${SEP}%s${SEP}%(trailers:key=Claude-Session,valueonly,separator=)`))
  .map((l) => {
    const [hash, author, date, subject, session] = l.split(SEP);
    return { hash, author, date: new Date(date), subject, session: session.trim() };
  });
const sessions = [...new Set(commits.map((c) => c.session).filter(Boolean))];
const latestSession = commits.find((c) => c.session)?.session ?? '';
const byClaude = commits.filter((c) => c.author === 'Claude').length;
const prs = lines(git('log', '--merges', '--format=%s')).map((s) => s.match(/^Merge pull request #(\d+)/)?.[1]).filter(Boolean).map(Number);
const now = new Date();
const last24h = commits.filter((c) => now - c.date < 24 * 3600 * 1000).length;

// 日ごとのコミット数(日本の日付で数える)
const dayKey = (d) => new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const perDay = new Map();
for (const c of commits) perDay.set(dayKey(c.date), (perDay.get(dayKey(c.date)) ?? 0) + 1);
const days = [...perDay.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-14);

// 公開している版(pages.yml の既定)と、そのあとの変更
const pagesYml = readFileSync('.github/workflows/pages.yml', 'utf8');
const pubRef = pagesYml.match(/default:\s*([0-9a-f]{7,40})/)?.[1] ?? '';
const pubNote = pagesYml.match(/#\s*いま公開している版(.*)\n/)?.[1]?.replace(/^[((]|[))]$/g, '') ?? '';
let unpublished = [];
let pubDate = '';
if (pubRef) {
  try {
    pubDate = git('log', '-1', '--format=%aI', pubRef);
    unpublished = lines(git('log', '--no-merges', `--format=%h${SEP}%s`, `${pubRef}..HEAD`)).map((l) => l.split(SEP));
  } catch {
    // 公開した版が手元にない(浅いクローンなど)
  }
}

// ---- コードの量 ----

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}
const tsFiles = walk('src');
const countLines = (f) => readFileSync(f, 'utf8').split('\n').length;
const testFiles = tsFiles.filter((f) => f.endsWith('.test.ts'));
const codeLines = tsFiles.filter((f) => !f.endsWith('.test.ts')).reduce((n, f) => n + countLines(f), 0);
const testLines = testFiles.reduce((n, f) => n + countLines(f), 0);

// ---- ゲームの中身 ----

const titleCount = (readFileSync('src/logic/titles.ts', 'utf8').match(/^ {4}id: '/gm) ?? []).length;
const stageCount = (readFileSync('src/logic/stages.ts', 'utf8').match(/^ {4}id: '/gm) ?? []).length;
const { SHEETS, IMAGES } = await import('../src/art/sheets.ts');
const manifest = JSON.parse(readFileSync('public/art/manifest.json', 'utf8'));
const artTotal = SHEETS.length + IMAGES.length;
const artPng = (manifest.sheets?.length ?? 0) + (manifest.images?.length ?? 0);

// ---- テストと型の確かめ ----

let tests = null;
let types = null;
if (!quick) {
  const dir = mkdtempSync(join(tmpdir(), 'sh-dash-'));
  const json = join(dir, 'vitest.json');
  spawnSync('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${json}`], { encoding: 'utf8' });
  try {
    const r = JSON.parse(readFileSync(json, 'utf8'));
    tests = { passed: r.numPassedTests, failed: r.numFailedTests, total: r.numTotalTests, files: r.numTotalTestSuites };
    tests.failures = r.testResults.flatMap((f) => f.assertionResults.filter((a) => a.status === 'failed')
      .map((a) => `${f.name.replace(process.cwd() + '/', '')}: ${a.fullName}`));
  } catch {
    tests = { error: true };
  }
  rmSync(dir, { recursive: true, force: true });
  const tsc = spawnSync('npx', ['tsc', '--noEmit'], { encoding: 'utf8' });
  types = { ok: tsc.status === 0, errors: (tsc.stdout.match(/error TS/g) ?? []).length };
}

// ---- やることと質問(docs/BOARD.md) ----

function readBoard() {
  const md = readFileSync('docs/BOARD.md', 'utf8');
  const table = (heading) => {
    const part = md.split(/^## /m).find((s) => s.startsWith(heading));
    if (!part) return [];
    return lines(part).filter((l) => l.startsWith('|')).slice(2)
      .map((l) => l.slice(1, -1).split('|').map((c) => c.trim()));
  };
  const tasks = table('やること').map(([id, state, title, blocker]) => ({ id, state, title, blocker }));
  const questions = table('質問').map(([id, state, question, answer]) => ({ id, state, question, answer }));
  return { tasks, questions };
}
const { tasks, questions } = readBoard();
const count = (arr, state) => arr.filter((t) => t.state === state).length;
const openQ = questions.filter((q) => q.state !== 'done');

// ---- HTML ----

const fmtDate = (d) => {
  const j = new Date(new Date(d).getTime() + 9 * 3600 * 1000);
  return `${j.getUTCMonth() + 1}/${j.getUTCDate()} ${String(j.getUTCHours()).padStart(2, '0')}:${String(j.getUTCMinutes()).padStart(2, '0')}`;
};
const md = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const STATE = { todo: 'まだ', doing: 'やっている', done: '終わった', wait: '止まっている' };
const ORDER = { doing: 0, wait: 1, todo: 2, done: 3 };
const pill = (state) => `<span class="pill s-${esc(state)}">${esc(STATE[state] ?? state)}</span>`;

function tile(label, value, sub, tone = '', bar = null) {
  const meter = bar === null ? '' : `<div class="meter" role="img" aria-label="${Math.round(bar * 100)}%"><i style="width:${Math.max(0, Math.min(1, bar)) * 100}%"></i></div>`;
  return `<div class="tile ${tone}"><div class="t-label">${label}</div><div class="t-value">${value}</div><div class="t-sub">${sub}</div>${meter}</div>`;
}

const testTile = tests === null
  ? tile('テスト', '—', '--quick でとばした')
  : tests.error
    ? tile('テスト', 'NG', 'vitestが動かなかった', 'bad')
    : tile('テスト', `${tests.passed}<small>/${tests.total}</small>`, `${tests.files}ファイル${tests.failed ? `、落ちた ${tests.failed}` : '、全部通った'}`, tests.failed ? 'bad' : 'good', tests.passed / Math.max(1, tests.total));
const typeTile = types === null
  ? tile('型の確かめ', '—', '--quick でとばした')
  : tile('型の確かめ', types.ok ? 'OK' : 'NG', types.ok ? 'tsc --noEmit' : `エラー ${types.errors}件`, types.ok ? 'good' : 'bad');

const tiles = [
  tile('公開していない変更', `${unpublished.length}<small>件</small>`, pubRef ? `公開中 ${esc(pubRef.slice(0, 7))}${pubDate ? `・${fmtDate(pubDate)}` : ''}` : '公開の版が分からない', unpublished.length ? 'warn' : 'good'),
  testTile,
  typeTile,
  tile('未回答の質問', `${openQ.length}`, `回答済み ${count(questions, 'done')}`, openQ.length ? 'warn' : ''),
  tile('やること', `${count(tasks, 'done')}<small>/${tasks.length}</small>`, `やっている ${count(tasks, 'doing')}・止まっている ${count(tasks, 'wait')}・まだ ${count(tasks, 'todo')}`, '', count(tasks, 'done') / Math.max(1, tasks.length)),
  tile('コミット', `${commits.length}`, `直近24時間 ${last24h}・マージしたPR ${prs.length}`),
  tile('Claudeのセッション', `${sessions.length}`, `Claudeのコミット ${byClaude}・人 ${commits.length - byClaude}`),
  tile('PNGにした絵', `${artPng}<small>/${artTotal}</small>`, 'のこりはコードで描いた絵', '', artPng / Math.max(1, artTotal)),
  tile('ステージ・称号', `${stageCount}<small>・${titleCount}</small>`, `ステージ ${stageCount}つ、称号 ${titleCount}個`),
  tile('コードの行', `${codeLines.toLocaleString()}`, `テスト ${testLines.toLocaleString()}行・${testFiles.length}ファイル`),
];

const maxDay = Math.max(1, ...days.map(([, n]) => n));
const chart = days.length ? `
<div class="bars" role="img" aria-label="日ごとのコミット数">
  ${days.map(([d, n]) => `<div class="bar" title="${d}: ${n}件"><span class="b-n">${n}</span><i style="height:${(n / maxDay) * 100}%"></i><span class="b-d">${d.slice(5).replace('-', '/')}</span></div>`).join('')}
</div>` : '<p class="muted">コミットがない</p>';

const sortedTasks = [...tasks].sort((a, b) => (ORDER[a.state] ?? 9) - (ORDER[b.state] ?? 9));
const taskRows = sortedTasks.map((t) => `<tr class="r-${esc(t.state)}"><td class="mono">${esc(t.id)}</td><td>${pill(t.state)}</td><td>${md(t.title)}</td><td class="muted">${md(t.blocker)}</td></tr>`).join('');
const qItems = [...openQ, ...questions.filter((q) => q.state === 'done')].map((q) => `
<li class="q ${q.state === 'done' ? 'q-done' : ''}">
  <div class="q-head"><span class="mono">${esc(q.id)}</span>${pill(q.state === 'done' ? 'done' : 'todo').replace('まだ', 'まだ答えていない')}</div>
  <p>${md(q.question)}</p>
  ${q.answer ? `<p class="q-a">答え:${md(q.answer)}</p>` : ''}
</li>`).join('');
const failList = tests?.failures?.length ? `<section><h2>落ちたテスト</h2><ul class="list">${tests.failures.map((f) => `<li class="mono">${esc(f)}</li>`).join('')}</ul></section>` : '';
const commitLi = (h, s) => `<li><span class="mono hash">${esc(h)}</span><span>${esc(s)}</span></li>`;

const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>StupidHero 開発ボード</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DotGothic16&family=Noto+Sans+JP:wght@400;700&display=swap">
<style>
:root{
  --bg:#f4f3f9;--surface:#ffffff;--ink:#1b1830;--muted:#625c7a;--line:#dcd8ea;
  --accent:#2f4cc0;--accent-soft:#e3e8fb;
  --good:#1d7a45;--good-soft:#e1f3e8;--warn:#8a5a00;--warn-soft:#fbefd2;--bad:#b3261e;--bad-soft:#fbe3e1;
  --idle:#8a84a3;--idle-soft:#ecebf2;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    color-scheme:dark;
    --bg:#0e0c1a;--surface:#17142a;--ink:#eeeaff;--muted:#a79fc4;--line:#3a3354;
    --accent:#8fa3ff;--accent-soft:#232048;
    --good:#5fcf8c;--good-soft:#16301f;--warn:#f5c542;--warn-soft:#352b10;--bad:#ff7a70;--bad-soft:#3a1715;
    --idle:#8a84a3;--idle-soft:#221f35;
  }
}
:root[data-theme="dark"]{
  color-scheme:dark;
  --bg:#0e0c1a;--surface:#17142a;--ink:#eeeaff;--muted:#a79fc4;--line:#3a3354;
  --accent:#8fa3ff;--accent-soft:#232048;
  --good:#5fcf8c;--good-soft:#16301f;--warn:#f5c542;--warn-soft:#352b10;--bad:#ff7a70;--bad-soft:#3a1715;
  --idle:#8a84a3;--idle-soft:#221f35;
}
body{background:var(--bg);color:var(--ink);font:14px/1.6 "Noto Sans JP","Hiragino Sans","Yu Gothic",system-ui,sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding-inline:16px;padding-block:20px 40px;display:grid;gap:28px}
header{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 16px}
h1{font-family:"DotGothic16",monospace;font-weight:400;font-size:24px;margin:0;letter-spacing:.02em}
h2{font-size:15px;margin:0 0 10px}
.meta{color:var(--muted);font-size:12px}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.92em;background:var(--idle-soft);padding:0 4px;border-radius:4px}
.muted{color:var(--muted)}
.tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media (min-width:720px){.tiles{grid-template-columns:repeat(5,minmax(0,1fr))}}
.tile{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:2px}
.t-label{font-size:12px;color:var(--muted)}
.t-value{font-family:"DotGothic16",monospace;font-size:28px;line-height:1.2;font-variant-numeric:tabular-nums}
.t-value small{font-size:16px;color:var(--muted)}
.t-sub{font-size:11.5px;color:var(--muted)}
.tile.good .t-value{color:var(--good)}.tile.warn .t-value{color:var(--warn)}.tile.bad .t-value{color:var(--bad)}
.tile.bad{border-color:var(--bad)}
.meter{height:4px;background:var(--idle-soft);border-radius:2px;margin-top:8px;overflow:hidden}
.meter i{display:block;height:100%;background:var(--accent);border-radius:2px}
.tile.good .meter i{background:var(--good)}
.box{background:var(--surface);border:1px solid var(--line);border-radius:10px;overflow-x:auto}
table{border-collapse:collapse;width:100%;min-width:520px}
td:last-child{min-width:8em}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;color:var(--muted);font-weight:400}
tr:last-child td{border-bottom:0}
tr.r-done td:nth-child(3){color:var(--muted)}
.pill{display:inline-block;font-size:11px;padding:1px 8px;border-radius:999px;white-space:nowrap;border:1px solid currentColor}
.s-doing{color:var(--accent);background:var(--accent-soft)}
.s-wait{color:var(--warn);background:var(--warn-soft)}
.s-todo{color:var(--muted);background:var(--idle-soft)}
.s-done{color:var(--good);background:var(--good-soft)}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:28px}
.qs{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.q{background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--warn);border-radius:8px;padding:10px 14px}
.q.q-done{border-left-color:var(--good);opacity:.8}
.q p{margin:4px 0 0}
.q-head{display:flex;gap:8px;align-items:center}
.q-a{color:var(--good)}
.list{list-style:none;margin:0;padding:0;background:var(--surface);border:1px solid var(--line);border-radius:10px}
.list li{display:flex;gap:10px;padding:7px 12px;border-bottom:1px solid var(--line)}
.list li:last-child{border-bottom:0}
.hash{color:var(--accent);flex:none;padding-top:2px}
.bars{display:flex;align-items:flex-end;gap:6px;height:150px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px 12px 8px}
.bar{flex:1;max-width:56px;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px}
.bar i{display:block;width:100%;background:var(--accent);border-radius:4px 4px 0 0;min-height:2px}
.bar:hover i{opacity:.8}
.b-n{font-size:11px;font-variant-numeric:tabular-nums}
.b-d{font-size:10.5px;color:var(--muted);white-space:nowrap}
a{color:var(--accent)}
.hint{font-size:12px;color:var(--muted);margin:8px 0 0}
</style>
<div class="wrap">
<header>
  <h1>StupidHero 開発ボード</h1>
  <div class="meta">${esc(branch)} @ <span class="mono">${esc(head)}</span>・${fmtDate(now)} に作成${latestSession ? `・<a href="${esc(latestSession)}">最新のセッション</a>` : ''}</div>
</header>

<section class="tiles">${tiles.join('')}</section>

${failList}

<div class="cols">
<section>
  <h2>未回答の質問 (${openQ.length})</h2>
  ${questions.length ? `<ul class="qs">${qItems}</ul>` : '<p class="muted">質問はない</p>'}
  <p class="hint">答えは <code>docs/BOARD.md</code> の「答え」に書くか、Claudeに伝える</p>
</section>
<section>
  <h2>日ごとのコミット</h2>
  ${chart}
</section>
</div>

<section>
  <h2>やること</h2>
  <div class="box"><table>
    <thead><tr><th>ID</th><th>状態</th><th>題</th><th>止まっている理由</th></tr></thead>
    <tbody>${taskRows}</tbody>
  </table></div>
</section>

<div class="cols">
<section>
  <h2>公開していない変更 (${unpublished.length})</h2>
  ${unpublished.length ? `<ul class="list">${unpublished.slice(0, 15).map(([h, s]) => commitLi(h, s)).join('')}</ul>` : '<p class="muted">公開中の版と同じ</p>'}
  ${pubNote ? `<p class="hint">公開中の版:${esc(pubNote)}</p>` : ''}
</section>
<section>
  <h2>最近のコミット</h2>
  <ul class="list">${commits.slice(0, 10).map((c) => commitLi(c.hash, c.subject)).join('')}</ul>
</section>
</div>
</div>
`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, html);
console.log(`書き出した: ${outFile}`);
if (tests?.failed || tests?.error || (types && !types.ok)) process.exitCode = 1;
