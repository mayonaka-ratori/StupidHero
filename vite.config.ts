import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // EXTERNAL_FONT=1 でビルドすると、フォントを同梱しない(Google Fonts から読むページに載せるとき)
  resolve: { alias: process.env.EXTERNAL_FONT ? { '@fontsource/dotgothic16': '/src/empty.css' } : {} },
  build: { target: 'es2020', assetsInlineLimit: 0 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] }
});
