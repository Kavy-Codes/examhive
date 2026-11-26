const fs = require('fs');
const path = require('path');

const root = __dirname;
const registry = JSON.parse(fs.readFileSync(path.join(root, 'links.json'), 'utf8'));
const errors = [];
const fail = (message) => errors.push(message);

const statuses = new Set(['working', 'slow', 'down', 'soon']);
const categoryIds = new Set(registry.categories.map((category) => category.id));
const sprite = fs.readFileSync(path.join(root, 'assets/icons/sprite.svg'), 'utf8');
const iconIds = new Set([...sprite.matchAll(/id="i-([a-z-]+)"/g)].map((match) => match[1]));
const seenIds = new Set();
const stats = {};

if (!registry.meta || Number.isNaN(Date.parse(registry.meta.checkedAt || ''))) fail('meta.checkedAt must be a valid ISO date');

registry.categories.forEach((category) => {
  if (!category.id || !category.label || !/^#[0-9a-f]{6}$/i.test(category.color || '')) {
    fail(`category ${category.id || '?'} needs an id, label and 6-digit hex color`);
  }
  if (!category.description) fail(`category ${category.id || '?'} needs a description`);
});

registry.links.forEach((link) => {
  const where = link.id || link.title || 'unnamed link';
  if (!link.id || seenIds.has(link.id)) fail(`duplicate or missing id: ${where}`);
  seenIds.add(link.id);
  if (!link.title || !link.description) fail(`${where} needs a title and description`);
  if (!categoryIds.has(link.category)) fail(`${where} references unknown category ${link.category}`);
  if (!statuses.has(link.status)) fail(`${where} has invalid status ${link.status}`);
  if (!iconIds.has(link.icon)) fail(`${where} uses unknown sprite icon "${link.icon}"`);
  if (link.url && (/javascript:/i.test(link.url) || /\s/.test(link.url))) fail(`${where} has an unusable url`);
  if (Number.isNaN(Date.parse(link.lastChecked || ''))) fail(`${where} has an invalid lastChecked`);
  if (Number.isNaN(Date.parse(link.addedAt || ''))) fail(`${where} has an invalid addedAt`);
  if (!link.safety || ['safe', 'ads', 'vpn'].some((key) => typeof link.safety[key] !== 'boolean')) {
    fail(`${where} needs safe, ads and vpn booleans`);
  }
  if (!Array.isArray(link.tags) || !link.tags.length) fail(`${where} needs at least one tag`);
  if (link.aliases && !Array.isArray(link.aliases)) fail(`${where} aliases must be an array`);
  if (link.hidden && link.failures < 3) fail(`${where} hidden before 3 failed checks`);
  stats[link.status] = (stats[link.status] || 0) + 1;
});

registry.categories.forEach((category) => {
  const featured = registry.links.filter((link) => link.category === category.id && link.featured);
  if (featured.length > 1) fail(`${category.id} has ${featured.length} featured links`);
});

if (errors.length) {
  console.error('Validation failed:');
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}

const visible = registry.links.filter((link) => !link.hidden);
console.log('Registry OK');
console.log(` ${visible.length} visible / ${registry.links.length} total links across ${registry.categories.length} shelves`);
console.log(` working ${stats.working || 0} / slow ${stats.slow || 0} / down ${stats.down || 0}`);
console.log(` last checked ${registry.meta.checkedAt}`);
