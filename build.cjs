const fs = require('fs');
const path = require('path');

const root = __dirname;
const registry = JSON.parse(fs.readFileSync(path.join(root, 'links.json'), 'utf8'));
const shelvesDir = path.join(root, 'shelves');
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const icon = (name, base) => `<svg class="ico" aria-hidden="true"><use href="${base}assets/icons/sprite.svg#i-${name}"></use></svg>`;

function relative(iso) {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function tags(link) {
  const items = [];
  if (link.safety.safe) items.push('<span class="tag tag-safe">Safe</span>');
  if (link.safety.ads) items.push('<span class="tag tag-ads">Ads</span>');
  if (link.safety.vpn) items.push('<span class="tag tag-vpn">VPN needed</span>');
  if (link.safety.noSignup !== false) items.push('<span class="tag tag-signup">No signup</span>');
  return items.join('');
}

function cardHtml(link, base) {
  const fresh = Date.now() - Date.parse(link.addedAt) < 7 * 24 * 3600 * 1000;
  const note = link.note ? `<p class="card-note">${esc(link.note)}</p>` : '';
  const href = link.url && !/^(https?:|mailto:)/.test(link.url) ? base + link.url : link.url;
  const action = href
    ? `<a class="open-btn" href="${esc(href)}" ${/^https?:/.test(href) ? 'target="_blank" rel="noopener noreferrer"' : ''} data-open="${esc(link.id)}">Open ${icon('arrow', base)}</a>`
    : `<span class="open-btn is-disabled">Coming soon</span>`;
  return `<article class="link-card status-${link.status}" data-id="${esc(link.id)}" data-status="${link.status}" data-checked="${esc(link.lastChecked)}" style="--card-color:${categoryById[link.category].color}">
    ${fresh ? '<span class="new-badge">New</span>' : ''}
    <div class="card-main">
      <span class="card-icon">${icon(link.icon, base)}</span>
      <div class="card-copy"><h3>${esc(link.title)}</h3><p>${esc(link.description)}</p>${note}</div>
    </div>
    <div class="card-meta">
      <span class="status status-${link.status}"><i></i>${statusLabel[link.status]} · <time datetime="${esc(link.lastChecked)}">checked ${relative(link.lastChecked)}</time></span>
      <span class="tags">${tags(link)}</span>
    </div>
    <div class="card-actions-row">${action}<button class="more-btn" type="button" data-more aria-expanded="false">Details ${icon('plus', base)}</button></div>
    <div class="card-extra" hidden>
      <button type="button" data-save>${icon('star', base)}<span>Save</span></button>
      <button type="button" data-upvote>${icon('check', base)}<span>Upvote</span></button>
      <button type="button" data-report>${icon('flag', base)}<span>Report broken</span></button>
      <button type="button" data-comments>${icon('users', base)}<span>Comments</span></button>
    </div>
  </article>`;
}

const statusLabel = { working: 'Working', slow: 'Slow', down: 'Down', soon: 'Soon' };
const categoryById = Object.fromEntries(registry.categories.map((category) => [category.id, category]));

function footer(base) {
  return `<footer class="footer"><div class="wrap footer-inner">
    <p class="disclaimer">ExamHive lists third-party links and hosts nothing. Some third-party links may lead to copyrighted material. Check your local laws and prefer open or legal sources where you can. Education, tools and open content are the point of this site.</p>
    <div class="footer-links"><a href="mailto:krush91@proton.me">Contact / takedown</a><a href="mailto:krush91@proton.me?subject=Broken%20link%20report">Report a broken link</a></div>
    <div class="footer-fine"><a href="${base}pages/safety.html">Before you click</a><a href="${base}pages/legal.html">Disclaimer</a><a href="${base}pages/changelog.html">What's new</a><a href="${base}pages/submit.html">Submit a link</a><a href="https://www.reddit.com/r/JEENEETards/" target="_blank" rel="noopener">Honourable mention: r/JEENEETards ↗</a></div>
  </div></footer>`;
}

function head(title, description, base) {
  return `<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title><meta name="description" content="${esc(description)}">
  <meta name="theme-color" content="#100d1c">
  <link rel="icon" href="${base}assets/icons/favicon.svg" type="image/svg+xml">
  <link rel="preload" href="${base}assets/fonts/bricolage-grotesque-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="${base}assets/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${base}assets/css/fonts.css"><link rel="stylesheet" href="${base}assets/css/site.css">
  <script defer src="${base}assets/js/links.js"></script><script defer src="${base}assets/js/site.js"></script>
</head>`;
}

function topbar(base, shelfId) {
  return `<header class="topbar"><div class="wrap topbar-inner">
    <a class="brand" href="${base}index.html"><img src="${base}assets/icons/hive-mark.svg" alt="" width="28" height="28"><span>Exam<span>Hive</span></span></a>
    <nav class="topnav"><a href="${base}index.html">Shelves</a><a href="${base}pages/changelog.html">What's new</a></nav>
    <a class="community-link" href="mailto:krush91@proton.me">${icon('mail', base)}<span>Contact</span></a>
  </div></header>`;
}

function shelfPage(category) {
  const base = '../';
  const links = registry.links.filter((link) => link.category === category.id && !link.hidden);
  const sorted = [...links].sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || Number(!!a.lowPriority) - Number(!!b.lowPriority));
  const warning = category.id === 'entertainment'
    ? `<div class="shelf-warning">${icon('shield', base)}<p>Entertainment links are user-submitted and third-party. Some entertainment sites may host copyrighted material. Check your local laws before using them. We host nothing.</p></div>`
    : '';
  return `${head(`${category.label} | ExamHive`, category.description, base)}
<body data-base="${base}" data-shelf="${category.id}">
  ${topbar(base)}
  <main class="wrap shelf">
    <a class="back" href="${base}index.html">← All shelves</a>
    <div class="shelf-head">
      <span class="eyebrow" style="--shelf:${category.color}">Shelf ${category.index} / 07</span>
      <h1 style="--shelf:${category.color}">${esc(category.label)}</h1>
      <p>${esc(category.description)}</p>
      <div class="shelf-flags"><span id="streak" class="mono"></span><span id="recentStrip" class="mono"></span></div>
    </div>
    ${warning}
    <div class="cards" id="cards">${sorted.map((link) => cardHtml(link, base)).join('')}</div>
    <p class="empty-note" id="emptyNote" hidden>No live links here right now. Check the <a href="${base}pages/changelog.html">changelog</a>.</p>
  </main>
  ${footer(base)}
</body></html>`;
}

fs.mkdirSync(shelvesDir, { recursive: true });
registry.categories.forEach((category) => {
  fs.writeFileSync(path.join(shelvesDir, `${category.id}.html`), shelfPage(category));
});

fs.writeFileSync(
  path.join(root, 'assets/js/links.js'),
  `/* Generated from links.json by build.cjs. Do not edit by hand. */\nwindow.EXAM_LINKS = ${JSON.stringify(registry)};\n`
);

const visible = registry.links.filter((link) => !link.hidden);
console.log(`Built ${registry.categories.length} shelf pages and assets/js/links.js: ${visible.length} visible links, ${registry.meta.checkedAt}.`);
