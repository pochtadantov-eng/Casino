/* TonUp — логотипы (5 вариантов) + экран загрузки 3 с.  Выбор хранится в localStorage. */
(function () {
  const G = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const V = [
    { name: 'Hex Up', note: 'Шестигранник со стрелкой вверх',
      svg: `<svg viewBox="0 0 48 48"><defs>${G('l1','#C6FF3D','#3DE0A0')}</defs><path d="M24 3 42 13.5v21L24 45 6 34.5v-21z" fill="url(#l1)"/><path d="M24 11.5 34 22.5h-6.6V35h-6.8V22.5H14z" fill="#07130A"/></svg>` },
    { name: 'T-Arrow', note: 'Буква T, ножка которой — стрелка',
      svg: `<svg viewBox="0 0 48 48"><defs>${G('l2','#C6FF3D','#7DFF6B')}</defs><rect x="3" y="3" width="42" height="42" rx="13" fill="url(#l2)"/><rect x="10" y="10" width="28" height="7" rx="3.5" fill="#0A1204"/><path d="M24 21 33 31.5h-6V39h-6v-7.5h-6z" fill="#0A1204"/></svg>` },
    { name: 'Star Rocket', note: 'Звезда Telegram, летящая вверх',
      svg: `<svg viewBox="0 0 48 48"><defs>${G('l3','#FFE45C','#FF9F1C')}</defs><path d="M24 3l6.2 13.4 14.6 1.8-10.8 10 2.9 14.5L24 35.4 11.1 42.7 14 28.2 3.2 18.2l14.6-1.8z" fill="url(#l3)"/><path d="M24 14 31 24h-4.5v9h-5v-9H17z" fill="#2A1500"/><circle cx="40" cy="8" r="2" fill="#FFE45C"/><circle cx="8" cy="9" r="1.4" fill="#FFE45C" opacity=".7"/></svg>` },
    { name: 'Neon Chip', note: 'Фишка казино со стрелкой роста',
      svg: `<svg viewBox="0 0 48 48"><defs>${G('l4','#FF3D81','#B66DFF')}</defs><circle cx="24" cy="24" r="21" fill="url(#l4)"/><circle cx="24" cy="24" r="21" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="3" stroke-dasharray="7 6.4"/><circle cx="24" cy="24" r="14.5" fill="#12081F"/><path d="M24 15.5 31 24h-4.4v8.5h-5.2V24H17z" fill="#C6FF3D"/></svg>` },
    { name: 'Spark U', note: 'Буква U-подкова и искра выигрыша',
      svg: `<svg viewBox="0 0 48 48"><defs>${G('l5','#3DE0FF','#B66DFF')}</defs><rect x="3" y="3" width="42" height="42" rx="14" fill="#0D0B1E" stroke="url(#l5)" stroke-width="2.4"/><path d="M14 11v14a10 10 0 0 0 20 0V11" fill="none" stroke="url(#l5)" stroke-width="6.4" stroke-linecap="round"/><path d="M34 6.5l1.6 3.6 3.6 1.6-3.6 1.6L34 17l-1.6-3.7-3.6-1.6 3.6-1.6z" fill="#C6FF3D"/></svg>` },
  ];
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  let cur = Math.min(4, Math.max(0, parseInt(ls.get('tonup_logo') || '0', 10) || 0));
  const $ = (s, r = document) => r.querySelector(s);

  function paint() {
    document.querySelectorAll('[data-logo]').forEach((el) => { el.innerHTML = V[cur].svg; });
    const bs = $('.brandrow > svg'); if (bs) bs.remove();
  }

  function splash(ms) {
    ms = ms || 5000;
    const old = $('#splash'); if (old) old.remove();
    const s = document.createElement('div'); s.id = 'splash';
    const P = (d, dx, i) => `<path pathLength="1" d="${d}" transform="translate(${dx} 0)" style="animation-delay:${(0.8 + i * 0.42).toFixed(2)}s" />`;
    const ton = ['M18 28C42 21 68 22 94 26', 'M58 24C56 48 60 70 56 88C54 96 48 98 44 92', 'M124 62C108 60 98 72 102 84C106 94 124 92 128 76C130 68 126 62 120 62', 'M130 80C136 84 142 76 146 64C148 58 148 54 146 54C144 54 144 80 144 92C146 70 160 50 172 60C178 66 172 84 174 92'];
    const up = ['M190 24C188 50 186 70 198 86C210 98 224 80 228 54C229 44 230 34 230 24', 'M230 30C230 54 228 76 224 94C228 94 236 90 240 80', 'M262 58C260 82 258 102 256 118', 'M258 70C268 54 288 56 288 72C288 88 270 94 258 84'];
    s.innerHTML = `<div class="sp-logo">${V[cur].svg}</div><svg class="sp-write" viewBox="0 0 286 130" fill="none" stroke-linecap="round" stroke-linejoin="round"><g class="w1">${ton.map((d, i) => P(d, [0, 0, -9, -9][i], i)).join('')}</g><g class="w2">${up.map((d, i) => P(d, [-12, -12, -28, -28][i], i + 4)).join('')}</g></svg><div class="sp-sub">играй · поднимайся</div><div class="sp-bar"><i style="animation-duration:${ms}ms"></i></div>`;
    document.body.appendChild(s);
    setTimeout(() => { s.classList.add('out'); setTimeout(() => s.remove(), 450); }, ms);
  }

  function picker() {
    const d = document.createElement('div'); d.id = 'logopick';
    d.innerHTML = `<div class="lp-box"><div class="lp-h"><b>Логотип</b><button class="lp-x" aria-label="Закрыть">✕</button></div><div class="lp-grid">${V.map((v, i) => `<button class="lp-it${i === cur ? ' on' : ''}" data-i="${i}"><span class="lp-pic">${v.svg}</span><b>${i + 1}. ${v.name}</b><small>${v.note}</small></button>`).join('')}</div><button class="lp-go">▶ Показать загрузку</button></div>`;
    document.body.appendChild(d);
    const close = () => d.remove();
    d.onclick = (e) => { if (e.target === d) close(); };
    $('.lp-x', d).onclick = close;
    d.querySelectorAll('.lp-it').forEach((b) => b.onclick = () => { cur = +b.dataset.i; ls.set('tonup_logo', cur); paint(); d.querySelectorAll('.lp-it').forEach((x) => x.classList.toggle('on', x === b)); });
    $('.lp-go', d).onclick = () => { close(); splash(5000); };
  }

  document.addEventListener('DOMContentLoaded', () => { });
  function init() { paint(); const b = $('#btn-logo'); if (b) b.onclick = picker; splash(5000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.TonLogo = { paint, splash, picker, variants: V };
})();
