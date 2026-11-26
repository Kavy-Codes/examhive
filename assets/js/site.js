(function () {
  'use strict';

  const data = window.EXAM_LINKS;
  if (!data) return;

  const base = document.body.dataset.base || '';
  const sprite = `${base}assets/icons/sprite.svg`;
  const icon = (name) => `<svg class="ico" aria-hidden="true"><use href="${sprite}#i-${name}"></use></svg>`;
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const categoryById = Object.fromEntries(data.categories.map((category) => [category.id, category]));
  const visible = data.links.filter((link) => !link.hidden);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const store = {
    get(key, fallback) {
      try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (_) {}
    }
  };

  const state = {
    saved: new Set(store.get('ph_saved', [])),
    upvotes: new Set(store.get('ph_upvotes', [])),
    recent: store.get('ph_recent', []),
    days: store.get('ph_days', []),
    statuses: store.get('ph_statuses', {}),
    visits: store.get('ph_visits', 0) + 1
  };
  store.set('ph_visits', state.visits);

  function relative(iso) {
    const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  }

  function toast(message) {
    const node = document.getElementById('toast') || createToast();
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove('show'), 3200);
  }

  function createToast() {
    const node = document.createElement('div');
    node.className = 'toast';
    node.id = 'toast';
    node.setAttribute('role', 'status');
    document.body.appendChild(node);
    return node;
  }

  function distance(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 3;
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i++) {
      const current = [i];
      for (let j = 1; j <= b.length; j++) {
        current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      previous = current;
    }
    return previous[b.length];
  }

  function score(link, query) {
    const q = query.trim().toLowerCase();
    if (!q) return 1;
    const title = link.title.toLowerCase();
    const category = categoryById[link.category].label.toLowerCase();
    const haystack = [title, link.description.toLowerCase(), category, ...(link.aliases || []), ...link.tags].join(' ');
    if (title === q) return 100;
    if (title.startsWith(q)) return 80;
    if (title.includes(q)) return 60;
    if (haystack.includes(q)) return 40;
    const words = [...new Set(haystack.split(/[^a-z0-9]+/).filter(Boolean))];
    const terms = q.split(/\s+/);
    if (terms.every((term) => words.some((word) => word.includes(term) || (term.length >= 4 && word.length >= 4 && distance(term, word) <= 2)))) return 20;
    return 0;
  }

  function search(query) {
    return visible
      .map((link) => ({ link, points: score(link, query) }))
      .filter((item) => item.points > 0)
      .sort((a, b) => b.points - a.points || Number(b.link.featured) - Number(a.link.featured))
      .slice(0, 8)
      .map((item) => item.link);
  }

  function statusText(link) {
    return `${link.status === 'working' ? 'Working' : link.status === 'slow' ? 'Slow' : 'Down'} · ${relative(link.lastChecked)}`;
  }

  function resolveUrl(link) {
    if (!link.url) return `${base}shelves/${link.category}.html`;
    if (/^(https?:|mailto:)/.test(link.url)) return link.url;
    return base + link.url;
  }

  function renderSearch(query) {
    const box = document.getElementById('searchResults');
    if (!box) return;
    const results = query.trim() ? search(query) : [];
    if (!results.length) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.innerHTML = results.map((link) => {
      const category = categoryById[link.category];
      const href = resolveUrl(link);
      return `<a class="search-result" data-result="${esc(link.id)}" href="${esc(href)}" style="--shelf:${category.color}" ${/^https?:/.test(href) ? 'target="_blank" rel="noopener noreferrer"' : ''}>
        <i class="swatch"></i>
        <span><strong>${esc(link.title)}</strong><small>${esc(category.label)} · ${esc(link.description)}</small></span>
        <span class="st">${statusText(link)}</span>
      </a>`;
    }).join('') + `<div class="search-hint">↑ ↓ to move · enter to open · esc to close</div>`;
    box.hidden = false;
  }

  function moveSelection(delta) {
    const box = document.getElementById('searchResults');
    if (!box || box.hidden) return;
    const items = [...box.querySelectorAll('.search-result')];
    if (!items.length) return;
    const current = items.findIndex((item) => item.classList.contains('selected'));
    const next = (current + delta + items.length) % items.length;
    items.forEach((item, index) => item.classList.toggle('selected', index === next));
  }

  function initSearch() {
    const input = document.getElementById('siteSearch');
    if (!input) return;
    const form = document.getElementById('searchForm');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const first = document.querySelector('#searchResults .search-result');
      if (first) first.click();
    });
    input.addEventListener('input', () => renderSearch(input.value));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveSelection(1);
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelection(-1);
      }
      if (event.key === 'Enter') {
        const selected = document.querySelector('#searchResults .search-result.selected');
        if (selected) {
          event.preventDefault();
          selected.click();
        }
      }
      if (event.key === 'Escape') {
        document.getElementById('searchResults').hidden = true;
        input.blur();
      }
    });
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.search-shell')) document.getElementById('searchResults').hidden = true;
    });
    document.addEventListener('keydown', (event) => {
      const active = document.activeElement;
      const typing = active && /input|textarea/i.test(active.tagName);
      if (event.key === '/' && !typing && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        input.focus();
      }
    });
  }

  function initCounts() {
    document.querySelectorAll('[data-shelf-count]').forEach((tile) => {
      const count = visible.filter((link) => link.category === tile.dataset.shelfCount).length;
      const foot = tile.querySelector('.tile-foot span');
      if (foot) foot.textContent = `${foot.textContent} · ${count} links`;
    });
    const total = document.getElementById('shelfCount');
    if (total) total.textContent = `${visible.length} live links`;
    const trust = document.getElementById('trust');
    if (trust) {
      const working = visible.filter((link) => link.status === 'working').length;
      trust.innerHTML = `<b>${visible.length} links</b> <span class="sep">·</span> <b>${working} working</b> <span class="sep">·</span> checked ${relative(data.meta.checkedAt)}`;
    }
  }

  function initPick() {
    const host = document.getElementById('pick');
    if (!host) return;
    const pool = visible.filter((link) => link.status === 'working' && link.featured);
    const fallback = visible.filter((link) => link.status === 'working');
    const links = pool.length ? pool : fallback;
    if (!links.length) {
      host.innerHTML = '<p class="disclaimer">No working links to feature right now. Check back after the next health run.</p>';
      return;
    }
    const day = new Date().toISOString().slice(0, 10);
    const hash = [...day].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 0);
    const link = links[Math.abs(hash) % links.length];
    const category = categoryById[link.category];
    document.getElementById('pickDate').textContent = day;
    host.innerHTML = `<article class="pick" style="--shelf:${category.color};--accent:${category.color}">
      <div class="pick-head">Today's pick · ${esc(category.label)}</div>
      <h3>${esc(link.title)}</h3>
      <p>${esc(link.description)}</p>
      <span class="status status-${link.status}" style="margin-top:12px"><i></i>${statusText(link)}</span>
      ${link.url ? `<a class="open-btn" href="${esc(resolveUrl(link))}" data-open="${esc(link.id)}" ${/^https?:/.test(resolveUrl(link)) ? 'target="_blank" rel="noopener noreferrer"' : ''}>Open ${icon('arrow')}</a>` : ''}
    </article>`;
  }

  function initShelfFlags() {
    const host = document.querySelector('.shelf-flags');
    if (!host) return;

    const today = new Date().toISOString().slice(0, 10);
    if (!state.days.includes(today)) {
      state.days.push(today);
      store.set('ph_days', state.days.slice(-90));
    }
    const dates = [...new Set(state.days)].sort().reverse();
    let streak = 0;
    let allowedMiss = 1;
    for (let index = 0; index < dates.length; index++) {
      const current = new Date(dates[index] + 'T00:00:00Z').getTime();
      if (index === 0) {
        streak = 1;
        continue;
      }
      const previous = new Date(dates[index - 1] + 'T00:00:00Z').getTime();
      const gap = Math.round((previous - current) / 86400000);
      if (gap === 1) streak++;
      else if (gap === 2 && allowedMiss) {
        allowedMiss = 0;
        streak++;
      } else break;
    }
    document.getElementById('streak').innerHTML = `${icon('flame')} ${streak}-day streak`;

    const recent = state.recent.slice(0, 3).map((id) => visible.find((link) => link.id === id)).filter(Boolean);
    document.getElementById('recentStrip').innerHTML = recent.length
      ? `Recently opened: ${recent.map((link) => `<a href="${esc(resolveUrl(link))}" data-open="${esc(link.id)}">${esc(link.title)}</a>`).join(', ')}`
      : '';

    const savedButton = document.createElement('button');
    savedButton.type = 'button';
    savedButton.id = 'savedFilter';
    savedButton.textContent = `Saved: ${state.saved.size}`;
    host.appendChild(savedButton);
  }

  function initCards() {
    document.querySelectorAll('.link-card').forEach((card) => {
      const id = card.dataset.id;
      const save = card.querySelector('[data-save]');
      const upvote = card.querySelector('[data-upvote]');
      if (save && state.saved.has(id)) {
        save.classList.add('is-on');
        save.querySelector('span').textContent = 'Saved';
      }
      if (upvote && state.upvotes.has(id)) {
        upvote.classList.add('is-on');
        upvote.querySelector('span').textContent = 'Upvoted';
      }
      if (card.dataset.status !== 'working') {
        const status = card.querySelector('.status');
        if (status) status.title = 'Checked automatically by the health script.';
      }
    });
  }

  function initSafety() {
    let pending = null;
    const dialog = document.createElement('dialog');
    dialog.id = 'safetyDialog';
    dialog.innerHTML = `<div class="dialog-head"><h2>Before you click</h2><button type="button" data-safety-close aria-label="Close">${icon('close')}</button></div>
      <div class="dialog-body"><p>These are third-party sites. We list links and host nothing. A quick check keeps you out of trouble.</p>
      <ol><li><strong>Keep an ad-blocker on.</strong> Pop-ups and fake download buttons are common on free streams.</li>
      <li><strong>Use a VPN where marked.</strong> Some mirrors geo-block or throttle traffic.</li>
      <li><strong>Read the badge.</strong> Working answered the last check, Slow blocked or lagged, Down did not respond.</li></ol>
      <p><a href="${base}pages/legal.html">Legal disclaimer ↗</a></p></div>
      <div class="dialog-foot"><a href="${base}pages/safety.html">Full guide</a><button type="button" data-safety-go>Open link</button></div>`;
    document.body.appendChild(dialog);

    function close() {
      if (dialog.open) dialog.close();
    }
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) close();
    });
    dialog.querySelector('[data-safety-close]').addEventListener('click', close);
    dialog.querySelector('[data-safety-go]').addEventListener('click', () => {
      store.set('ph_safety_seen', true);
      close();
      if (pending) window.open(pending, '_blank', 'noopener');
      pending = null;
    });

    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-open]');
      if (!trigger || trigger.hasAttribute('data-search-result')) return;
      const id = trigger.dataset.open;
      const link = data.links.find((item) => item.id === id);
      if (!link || !/^https?:/.test(link.url)) return;
      state.recent = [id, ...state.recent.filter((item) => item !== id)].slice(0, 12);
      store.set('ph_recent', state.recent);
      if (!store.get('ph_safety_seen', false)) {
        event.preventDefault();
        pending = resolveUrl(link);
        dialog.showModal();
      }
    });

    document.addEventListener('click', (event) => {
      const result = event.target.closest('[data-result]');
      if (!result) return;
      const id = result.dataset.result;
      state.recent = [id, ...state.recent.filter((item) => item !== id)].slice(0, 12);
      store.set('ph_recent', state.recent);
      const link = data.links.find((item) => item.id === id);
      if (link && /^https?:/.test(link.url) && !store.get('ph_safety_seen', false)) {
        event.preventDefault();
        pending = resolveUrl(link);
        dialog.showModal();
      }
    });
  }

  function initActions() {
    document.addEventListener('click', (event) => {
      const more = event.target.closest('[data-more]');
      if (more) {
        const panel = more.closest('.link-card').querySelector('.card-extra');
        const open = more.getAttribute('aria-expanded') === 'true';
        more.setAttribute('aria-expanded', String(!open));
        panel.hidden = open;
        return;
      }

      const save = event.target.closest('[data-save]');
      if (save) {
        const id = save.closest('.link-card').dataset.id;
        if (state.saved.has(id)) state.saved.delete(id);
        else state.saved.add(id);
        store.set('ph_saved', [...state.saved]);
        const on = state.saved.has(id);
        save.classList.toggle('is-on', on);
        save.querySelector('span').textContent = on ? 'Saved' : 'Save';
        const counter = document.getElementById('savedFilter');
        if (counter) counter.textContent = `Saved: ${state.saved.size}`;
        toast(on ? 'Saved in this browser.' : 'Removed from saved.');
        return;
      }

      const upvote = event.target.closest('[data-upvote]');
      if (upvote) {
        const id = upvote.closest('.link-card').dataset.id;
        if (state.upvotes.has(id)) state.upvotes.delete(id);
        else state.upvotes.add(id);
        store.set('ph_upvotes', [...state.upvotes]);
        const on = state.upvotes.has(id);
        upvote.classList.toggle('is-on', on);
        upvote.querySelector('span').textContent = on ? 'Upvoted' : 'Upvote';
        toast(on ? 'Upvoted. Thanks.' : 'Upvote removed.');
        return;
      }

      const report = event.target.closest('[data-report]');
      if (report) {
        const id = report.closest('.link-card').dataset.id;
        const link = data.links.find((item) => item.id === id);
        if (!link) return;
        const subject = `ExamHive: broken link — ${link.title}`;
        const body = `Link: ${link.url || 'unknown'}\nStatus: ${link.status}\nLast checked: ${link.lastChecked}\n\nWhat happened:`;
        window.location.href = `mailto:krush91@proton.me?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        toast('Report prepared in your mail app.');
        return;
      }

      const comments = event.target.closest('[data-comments]');
      if (comments) {
        toast('Comments open once moderation is live.');
        return;
      }

      const savedFilter = event.target.closest('#savedFilter');
      if (savedFilter) {
        const filtering = savedFilter.dataset.on === 'true';
        savedFilter.dataset.on = String(!filtering);
        savedFilter.textContent = filtering ? `Saved: ${state.saved.size}` : 'Show all';
        document.querySelectorAll('.link-card').forEach((card) => {
          card.hidden = !filtering && !state.saved.has(card.dataset.id);
        });
        const note = document.getElementById('emptyNote');
        if (note) note.hidden = !(!filtering && state.saved.size === 0);
      }
    });
  }

  function initRecovery() {
    const current = {};
    visible.forEach((link) => { current[link.id] = link.status; });
    const recovered = visible.filter((link) => state.saved.has(link.id) && link.status === 'working' && ['down', 'slow'].includes(state.statuses[link.id]));
    store.set('ph_statuses', current);
    state.statuses = current;
    if (recovered.length) setTimeout(() => toast(`Good news — ${recovered[0].title} is working again.`), 900);
  }

  function initPwa() {
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = base + 'manifest.webmanifest';
      document.head.appendChild(link);
    }
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register(base + 'sw.js').catch(() => {});
    }
    let installEvent = null;
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      installEvent = event;
      if (state.visits < 3 || store.get('ph_pwa_done', false)) return;
      const bar = document.createElement('div');
      bar.className = 'pwa-bar';
      bar.innerHTML = '<span>Keep ExamHive on your home screen.</span><button type="button" data-install>Install</button><button type="button" data-dismiss>Not now</button>';
      document.body.appendChild(bar);
      bar.querySelector('[data-install]').addEventListener('click', async () => {
        bar.remove();
        store.set('ph_pwa_done', true);
        if (!installEvent) return;
        installEvent.prompt();
        await installEvent.userChoice;
        installEvent = null;
      });
      bar.querySelector('[data-dismiss]').addEventListener('click', () => {
        bar.remove();
        store.set('ph_pwa_done', true);
      });
    });
  }

  function initChart() {
    const host = document.getElementById('chartLines');
    if (!host) return;
    const total = visible.length || 1;
    host.innerHTML = data.categories.map((category) => {
      const count = visible.filter((link) => link.category === category.id).length;
      return `<button type="button" class="chart-line" data-chart="${esc(category.id)}" style="--chart-color:${category.color};--fill:${Math.round((count / total) * 100)}%">
        <i class="swatch"></i><span>${esc(category.label)}</span><span class="count">${String(count).padStart(2, '0')}</span><div class="bar"><i></i></div>
      </button>`;
    }).join('');
    const totalNode = document.getElementById('chartTotal');
    if (totalNode) totalNode.textContent = `EH/${visible.length}`;
    host.addEventListener('click', (event) => {
      const row = event.target.closest('[data-chart]');
      if (row) window.location.href = `${base}shelves/${row.dataset.chart}.html`;
    });
  }

  function drawMark(parent, name, color) {
    const markup = (window.HIVE_ICONS || {})[name];
    if (!markup) return;
    const scale = 0.78;
    const stroke = 2.4;
    const at = (x, y) => ({ x: (x - 12) * scale, y: (y - 12) * scale, z: 21 });
    const value = (tag, key) => {
      const match = tag.match(new RegExp(key + '="([^"]+)"'));
      return match ? parseFloat(match[1]) : 0;
    };
    const parse = (d) => {
      const tokens = d.match(/[MLCZHVmlczhv]|[-+]?(?:\d*\.\d+|\d+\.?\d*)/g) || [];
      const paths = [];
      let current = [];
      let closed = false;
      let index = 0;
      const next = () => parseFloat(tokens[index++]);
      const base = () => {
        const last = current[current.length - 1] || at(12, 12);
        return { x: last.x / scale + 12, y: last.y / scale + 12 };
      };
      while (index < tokens.length) {
        const command = tokens[index++];
        const relative = command === command.toLowerCase();
        const origin = base();
        if (command === 'M' || command === 'm') {
          if (current.length) paths.push({ points: current, closed });
          const x = next();
          current = [at(relative ? origin.x + x : x, relative ? origin.y + next() : next())];
          closed = false;
        } else if (command === 'L' || command === 'l') {
          const x = next();
          current.push(at(relative ? origin.x + x : x, relative ? origin.y + next() : next()));
        } else if (command === 'H' || command === 'h') {
          const x = next();
          current.push(at(relative ? origin.x + x : x, origin.y));
        } else if (command === 'V' || command === 'v') {
          const y = next();
          current.push(at(origin.x, relative ? origin.y + y : y));
        } else if (command === 'C' || command === 'c') {
          const x1 = next(), y1 = next(), x2 = next(), y2 = next(), x = next(), y = next();
          const start = current[current.length - 1] || at(12, 12);
          const a = at(relative ? origin.x + x1 : x1, relative ? origin.y + y1 : y1);
          const b = at(relative ? origin.x + x2 : x2, relative ? origin.y + y2 : y2);
          const end = at(relative ? origin.x + x : x, relative ? origin.y + y : y);
          for (let step = 1; step <= 8; step++) {
            const t = step / 8;
            const u = 1 - t;
            current.push({
              x: u * u * u * start.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t * t * t * end.x,
              y: u * u * u * start.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t * t * t * end.y
            });
          }
        } else if (command === 'Z' || command === 'z') {
          closed = true;
          if (current.length) paths.push({ points: current, closed });
          current = [];
        }
      }
      if (current.length) paths.push({ points: current, closed });
      return paths;
    };

    [...markup.matchAll(/<circle\b([^>]*)>/g)].forEach((match) => {
      const tag = match[1];
      new Zdog.Ellipse({
        addTo: parent,
        diameter: value(tag, 'r') * 2 * scale,
        stroke,
        color,
        translate: at(value(tag, 'cx'), value(tag, 'cy'))
      });
    });
    [...markup.matchAll(/<rect\b([^>]*)>/g)].forEach((match) => {
      const tag = match[1];
      const width = value(tag, 'width') * scale;
      const height = value(tag, 'height') * scale;
      new Zdog.Rect({
        addTo: parent,
        width,
        height,
        stroke,
        color,
        translate: at(value(tag, 'x') + width / (2 * scale), value(tag, 'y') + height / (2 * scale))
      });
    });
    [...markup.matchAll(/<path\b([^>]*)>/g)].forEach((match) => {
      const d = (match[1].match(/d="([^"]+)"/) || [])[1];
      if (!d) return;
      parse(d).forEach((shape) => {
        new Zdog.Shape({ addTo: parent, path: shape.points, closed: shape.closed, stroke, color, translate: { z: 21 } });
      });
    });
    [...markup.matchAll(/<line\b([^>]*)>/g)].forEach((match) => {
      const tag = match[1];
      new Zdog.Shape({
        addTo: parent,
        path: [at(value(tag, 'x1'), value(tag, 'y1')), at(value(tag, 'x2'), value(tag, 'y2'))],
        stroke,
        color,
        translate: { z: 21 }
      });
    });
  }

  function initHive() {
    const canvas = document.getElementById('hiveCanvas');
    if (!canvas || !window.Zdog) return;
    let spinning = !reduced;
    const illo = new Zdog.Illustration({
      element: canvas,
      zoom: 2,
      rotate: { x: -0.34, y: -0.2 },
      dragRotate: true,
      onDragStart: () => { spinning = false; }
    });
    const radius = 24;
    const shades = ['#ffd45e', '#ffc247', '#ffb020', '#f5a400', '#ffd166', '#e59400', '#ffc75a'];
    const cells = [{ q: 0, r: 0, shelf: 'hive' }];
    [[1, 0, 'entertainment'], [0, 1, 'jeeneet'], [-1, 1, 'btech'], [-1, 0, 'ebooks'], [0, -1, 'games'], [1, -1, 'info']]
      .forEach(([q, r, shelf]) => cells.push({ q, r, shelf }));

    cells.forEach((cell, index) => {
      const anchor = new Zdog.Anchor({
        addTo: illo,
        translate: { x: 1.5 * radius * cell.q, y: Math.sqrt(3) * radius * (cell.r + cell.q / 2) },
        rotate: { z: Zdog.TAU / 12 }
      });
      for (let layer = 0; layer < 6; layer++) {
        new Zdog.Polygon({
          addTo: anchor,
          sides: 6,
          radius,
          stroke: 5,
          fill: false,
          color: ['#8a5a00', '#a86c00', '#c88400', '#e09a00', '#f5ad08', '#ffb020'][layer],
          translate: { z: -18 + layer * 7 }
        });
      }
      new Zdog.Polygon({ addTo: anchor, sides: 6, radius, stroke: 7, color: '#ffc247', translate: { z: 18 } });
      new Zdog.Polygon({ addTo: anchor, sides: 6, radius: radius - 5, fill: true, color: shades[index], translate: { z: 18 } });
      new Zdog.Polygon({ addTo: anchor, sides: 6, radius: radius - 5, stroke: 2, color: '#c98400', translate: { z: 19 } });
      const marks = { entertainment: 'film', jeeneet: 'target', btech: 'code', ebooks: 'book', games: 'gamepad', info: 'info', hive: 'hex' };
      drawMark(anchor, marks[cell.shelf], '#5c3400');
    });

    function frame() {
      if (!document.hidden) {
        if (spinning) illo.rotate.y += 0.005;
        illo.updateRenderGraph();
      }
      if (!reduced) requestAnimationFrame(frame);
    }
    frame();
  }

  initSearch();
  initCounts();
  initPick();
  initShelfFlags();
  initCards();
  initSafety();
  initActions();
  initRecovery();
  initPwa();
  initChart();
  initHive();
})();
