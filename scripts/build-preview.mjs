// Builds a single self-contained HTML (demo backend included) for sharing a live preview.
// Usage: node scripts/build-preview.mjs <out.html>
import { readFileSync, writeFileSync } from 'node:fs';
const f = (n) => new URL('../webapp/' + n, import.meta.url);
const r = (n) => readFileSync(f(n), 'utf8');
const body = r('index.html').match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script src="[^"]+"><\/script>/g, '');
const svg = readFileSync(f('rocket.svg')).toString('base64');
const out = `<title>Stars Casino</title>
<style>${r('style.css')}\nhtml,body{height:auto}body{max-width:520px;margin-inline:auto}</style>
${body}
<script>window.ROCKET_SRC='data:image/svg+xml;base64,${svg}'</script>
<script>${r('fx-rocket.js')}</script>
<script>${r('mock-api.js')}</script>
<script>${r('app.js')}</script>
<script>${r('shell.js')}</script>`;
writeFileSync(process.argv[2] || 'preview.html', out);
console.log('preview built', out.length, 'bytes');
