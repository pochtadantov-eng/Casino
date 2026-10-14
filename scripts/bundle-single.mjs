// Builds ONE self-contained HTML (demo mode: CSS, JS, fonts and pictures inlined) from a build-pages output folder.
// Usage: node scripts/build-pages.mjs _site && node scripts/bundle-single.mjs _site out.html
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
const dir = process.argv[2] || '_site', outFile = process.argv[3] || 'tonup-demo.html';
const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.gif': 'image/gif' };
const uri = (f) => `data:${MIME[extname(f)]};base64,${readFileSync(f).toString('base64')}`;
const walk = (d, base = '') => readdirSync(d).flatMap((n) => { const p = join(d, n), r = base ? `${base}/${n}` : n; return statSync(p).isDirectory() ? walk(p, r) : [[r, p]]; });
const assets = walk(dir).filter(([r]) => MIME[extname(r)] && /^(img|fonts)\//.test(r)).sort((a, b) => b[0].length - a[0].length);
const inlineAssets = (text) => { text = text.replace(/((?:img|fonts)\/[\w./-]+|rocket\.svg)\?v=\w+/g, '$1'); for (const [r, p] of assets) if (text.includes(r)) text = text.split(r).join(uri(p)); return text; };
const strip = (u) => u.replace(/\?v=[^"']*$/, '');
let html = readFileSync(join(dir, 'index.html'), 'utf8');
html = html.replace('<head>', `<head><script>window.ROCKET_SRC="${uri(join(dir, 'rocket.svg'))}";</script>`);
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, h) => { try { return `<style>${inlineAssets(readFileSync(join(dir, strip(h)), 'utf8'))}</style>`; } catch { return m; } });
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, s) => { if (/^https?:/.test(s)) return m; try { return `<script>${inlineAssets(readFileSync(join(dir, strip(s)), 'utf8')).replace(/<\/script/gi, '<\\/script')}</script>`; } catch { return m; } });
html = inlineAssets(html);
writeFileSync(outFile, html);
console.log(outFile, (html.length / 1048576).toFixed(2), 'MB');
