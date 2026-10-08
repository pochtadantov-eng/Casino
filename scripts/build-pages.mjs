// Static build of the Mini App in demo mode (in-browser backend) for GitHub Pages.
// Usage: node scripts/build-pages.mjs <outDir>
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2] || 'pages';
const src = (f) => new URL('../webapp/' + f, import.meta.url);
mkdirSync(out, { recursive: true });
for (const f of ['style.css', 'app.js', 'shell.js', 'mock-api.js', 'fx-rocket.js', 'fx-cards.js', 'rocket.svg']) copyFileSync(src(f), `${out}/${f}`);
mkdirSync(`${out}/img`, { recursive: true });
for (const f of readdirSync(new URL('../webapp/img/', import.meta.url))) copyFileSync(src('img/' + f), `${out}/img/${f}`);
const html = readFileSync(src('index.html'), 'utf8').replace(
  '<script src="app.js"></script>',
  '<script src="mock-api.js"></script>\n<script src="app.js"></script>',
);
writeFileSync(`${out}/index.html`, html);
writeFileSync(`${out}/.nojekyll`, '');
console.log('pages built in', out);
