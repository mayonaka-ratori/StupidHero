import { defineConfig } from 'vitest/config';

// 同じ node_modules を分けあう作業用のコピーで、それぞれ別の置き場を使えるように
const cacheDir = process.env.VITE_CACHE_DIR ?? 'node_modules/.vite';

export default defineConfig(({ mode }) => ({
  base: './',
  cacheDir,
  // --mode page でビルドすると、フォントを同梱しない(Google Fonts から読むページに載せるとき)
  resolve: { alias: mode === 'page' ? { '@fontsource/dotgothic16': '/src/empty.css' } : {} },
  build: { target: 'es2020', assetsInlineLimit: 0 },
  // テストのたびに全部のファイルを変換し直さないよう、変換した結果を残しておく(2回目から数秒速くなる)
  test: { environment: 'node', include: ['src/**/*.test.ts'], fsModuleCache: true, fsModuleCachePath: `${cacheDir}/vitest-fs` }
}));
