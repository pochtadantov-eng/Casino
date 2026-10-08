// Builds a single self-contained HTML (demo backend included) for sharing a live preview.
// Usage: node scripts/build-preview.mjs <out.html>
import { readFileSync, writeFileSync } from 'node:fs';
const r = (f) => readFileSync(new URL('../webapp/' + f, import.meta.url), 'utf8');
const html = r('index.html');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script src="fx-rocket.js"><\/script>\s*<script src="app.js"><\/script>/, '');
const out = `<title>Stars Casino</title>
<style>${r('style.css')}\nhtml,body{height:auto;background:var(--bg)}body{margin:0;max-width:520px;margin-inline:auto}</style>
${body}
<script>window.ROCKET_SRC='data:image/png;base64,${readFileSync(new URL('../webapp/rocket.png', import.meta.url)).toString('base64')}'</script>\n<script>${r('fx-rocket.js')}</script>\n<script>${r('mock-api.js')}</script>
<script>${r('app.js')}</script>`;
writeFileSync(process.argv[2] || 'preview.html', out);
console.log('preview built', out.length, 'bytes');
