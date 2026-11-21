/* Replaces every ⭐ emoji in the DOM (static and dynamic) with the Stars icon <i class="stz">. */
(function () {
  const RE = /⭐️?/;
  const skip = (n) => { const p = n.parentNode; return !p || /^(SCRIPT|STYLE|TEXTAREA|INPUT|TITLE)$/.test(p.nodeName) || (p.classList && p.classList.contains('stz')); };
  function fix(node) {
    if (node.nodeType === 3) {
      if (!RE.test(node.nodeValue) || skip(node)) return;
      const parts = node.nodeValue.split(/⭐️?/), f = document.createDocumentFragment();
      parts.forEach((t, i) => { if (t) f.appendChild(document.createTextNode(t)); if (i < parts.length - 1) { const s = document.createElement('tg-star'); s.className = 'stz'; s.setAttribute('aria-label', 'звёзд'); f.appendChild(s); } });
      node.parentNode.replaceChild(f, node);
    } else if (node.nodeType === 1 && !/^(SCRIPT|STYLE)$/.test(node.nodeName)) {
      const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), list = [];
      while (w.nextNode()) if (RE.test(w.currentNode.nodeValue)) list.push(w.currentNode);
      list.forEach(fix);
    }
  }
  function start() {
    fix(document.body);
    new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') fix(m.target); else m.addedNodes.forEach(fix); } }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
