// Static build of the Mini App in demo mode (in-browser backend) for GitHub Pages.
// Usage: node scripts/build-pages.mjs <outDir>
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2] || 'pages';
const src = (f) => new URL('../webapp/' + f, import.meta.url);
mkdirSync(out, { recursive: true });
for (const f of ['style.css', 'app.js', 'shell.js', 'mock-api.js', 'fx-rocket.js', 'fx-cards.js', 'fx-tower.js', 'fx-tower2d.js', 'rocket.svg']) copyFileSync(src(f), `${out}/${f}`);
mkdirSync(`${out}/img`, { recursive: true }); mkdirSync(`${out}/vendor`, { recursive: true });
for (const f of readdirSync(new URL('../webapp/vendor/', import.meta.url))) copyFileSync(src('vendor/' + f), `${out}/vendor/${f}`); mkdirSync(`${out}/fonts`, { recursive: true });
for (const f of readdirSync(new URL('../webapp/fonts/', import.meta.url))) copyFileSync(src('fonts/' + f), `${out}/fonts/${f}`);
for (const f of readdirSync(new URL('../webapp/img/', import.meta.url))) copyFileSync(src('img/' + f), `${out}/img/${f}`);
// Cache busting: every asset URL carries the build id, and index.html checks version.json (never cached)
// and reloads itself once if a newer build exists. Telegram keeps the hash (#tgWebAppData) intact on reload.
const BUILD = (process.env.GITHUB_SHA || Date.now().toString(36)).slice(0, 10);
writeFileSync(`${out}/version.json`, JSON.stringify({ v: BUILD }));
const loader = `<script>window.BUILD='${BUILD}';(function(){var B='${BUILD}';try{var q=new URLSearchParams(location.search);fetch('version.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.json()}).then(function(j){if(j.v&&j.v!==B&&q.get('v')!==j.v){q.set('v',j.v);location.replace(location.pathname+'?'+q.toString()+location.hash)}}).catch(function(){})}catch(e){}})();</script>`;
const html = readFileSync(src('index.html'), 'utf8')
  .replace('<script src="app.js"></script>', '<script src="mock-api.js"></script>\n<script src="app.js"></script>')
  .replace(/(src|href)="((?:img\/)?[\w.-]+\.(?:js|css|webp|svg|png))"/g, `$1="$2?v=${BUILD}"`)
  .replace('<head>', `<head>\n${loader}`);
writeFileSync(`${out}/index.html`, html);
writeFileSync(`${out}/.nojekyll`, '');
console.log('pages built in', out);
