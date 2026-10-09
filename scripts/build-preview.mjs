// Builds a single self-contained HTML (demo backend included) for sharing a live preview.
// Usage: node scripts/build-preview.mjs <out.html>
import { readFileSync, writeFileSync } from 'node:fs';
const f = (n) => new URL('../webapp/' + n, import.meta.url);
const r = (n) => readFileSync(f(n), 'utf8');
const mime = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
const body = r('index.html').match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script src="[^"]+"><\/script>/g, '')
  .replace(/src="img\/([\w.]+)"/g, (_, n) => `src="data:${mime[n.split('.').pop()]};base64,${readFileSync(f('img/' + n)).toString('base64')}"`);
const svg = readFileSync(f('rocket.svg')).toString('base64');
const css = r('style.css').replace(/url\(fonts\/([\w.-]+)\)/g, (_, n) => `url(data:font/woff2;base64,${readFileSync(f('fonts/' + n)).toString('base64')})`);
const out = `<title>Stars Casino</title>
<style>${css}\nhtml,body{height:auto}body{max-width:520px;margin-inline:auto}</style>
${body}
<script>window.ROCKET_SRC='data:image/svg+xml;base64,${svg}'</script>
<script>window.CARD_IMG={${[0, 1, 2, 3, 4].map((i) => `'house_${i}.webp':'data:image/webp;base64,${readFileSync(f(`img/house_${i}.webp`)).toString('base64')}'`).join(',')},'hook.webp':'data:image/webp;base64,${readFileSync(f('img/hook.webp')).toString('base64')}'}</script>\n<script>${r('fx-rocket.js')}</script>\n<script>${r('fx-cards.js')}</script>\n<script>${r('fx-props.js')}</script>\n<script>${r('fx-tower.js')}</script>
<script>${process.env.EASY ? 'window.EASY_TOWER=true' : ''}</script>\n<script>${(function(){const r={};try{r.default='data:image/svg+xml;base64,'+readFileSync(f('img/avatars/default.svg')).toString('base64');}catch(e){}return 'window.AV_SRC='+JSON.stringify(r);})()}</script>\n<script>window.WORKER_SRC='data:image/webp;base64,${readFileSync(f('img/worker.webp')).toString('base64')}'</script>\n<script>window.MUSIC_SRC={tower:'data:audio/mpeg;base64,${readFileSync(f('audio/tower.mp3')).toString('base64')}',mines:'data:audio/mpeg;base64,${readFileSync(f('audio/mines.mp3')).toString('base64')}',rocket:'data:audio/mpeg;base64,${readFileSync(f('audio/rocket.mp3')).toString('base64')}'}</script>
<script>window.BUILDER_SRC={body:'data:image/webp;base64,${readFileSync(f('img/builder_body.webp')).toString('base64')}',arm:'data:image/webp;base64,${readFileSync(f('img/builder_arm.webp')).toString('base64')}'}</script>
<script>${r('fx-rocket-feed.js')}</script>
<script>${r('mock-api.js')}</script>
<script>${r('app.js')}</script>
<script>${r('shell.js')}</script>`;
writeFileSync(process.argv[2] || 'preview.html', out);
console.log('preview built', out.length, 'bytes');
