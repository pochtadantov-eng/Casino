// Card media slots: put an animated picture into webapp/img/cards/<key>.<ext> and it appears in the lobby tile.
// Keys: bonus, mines, rocket, tower, dig, plinko, slot, luck, seagull. Formats tried in order: webm, webp, gif, png.
// No file => the tile keeps its built-in art. No code changes are needed to add, replace or remove a file.
(() => {
  const EXT = ['webm', 'webp', 'gif', 'png'];
  const v = window.BUILD ? '?v=' + window.BUILD : '';
  function probe(key, i, ok) {
    if (i >= EXT.length) return;
    const src = `img/cards/${key}.${EXT[i]}${v}`;
    const next = () => probe(key, i + 1, ok);
    if (EXT[i] === 'webm') {
      const el = document.createElement('video');
      Object.assign(el, { muted: true, loop: true, autoplay: true, playsInline: true, preload: 'auto' });
      el.setAttribute('muted', ''); el.setAttribute('playsinline', '');
      el.onloadeddata = () => { ok(el); el.play().catch(() => {}); };
      el.onerror = next; el.src = src;
    } else {
      const el = new Image(); el.alt = ''; el.decoding = 'async';
      el.onload = () => ok(el); el.onerror = next; el.src = src;
    }
  }
  document.querySelectorAll('.card[data-game], .card[data-go]').forEach((card) => {
    const key = card.dataset.media || card.dataset.game || card.dataset.go;
    probe(key, 0, (el) => {
      const box = document.createElement('div'); box.className = 'media'; box.append(el);
      card.prepend(box); card.classList.add('has-media');
    });
  });
})();
