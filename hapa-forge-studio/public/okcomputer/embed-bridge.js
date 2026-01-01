(function () {
  function safeText(sel, text) {
    const el = document.querySelector(sel);
    if (el && typeof text === 'string') el.textContent = text;
  }

  function safeImg(sel, dataUrl) {
    const img = document.querySelector(sel);
    if (img && typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
      img.src = dataUrl;
    }
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || msg.type !== 'HAPA_FORGE_CHARACTER_UPDATE') return;

    const p = msg.profile || {};

    // Update title + basic identity
    safeText('title', p.name ? `${p.name} - Character Profile | Hapa Forge Studio` : document.title);
    safeText('.character-frame h2', p.name || '');
    safeText('.character-frame p.text-amber-400', p.title || '');

    // Level + class badges
    const badges = document.querySelectorAll('.character-frame .flex.justify-center span');
    if (badges && badges.length >= 2) {
      if (typeof p.level === 'number') badges[0].textContent = `Level ${p.level}`;
      if (typeof p.className === 'string') badges[1].textContent = p.className;
    }

    // Avatar
    safeImg('.character-portrait img', p.portraitDataUrl || p.avatarDataUrl);

    // Quote (best-effort)
    if (typeof p.quote === 'string') {
      safeText('p.italic', p.quote);
    }
  });
})();
