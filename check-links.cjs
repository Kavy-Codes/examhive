const fs = require('fs');
const path = require('path');

const root = __dirname;
const registryPath = path.join(root, 'links.json');
const checksPath = path.join(root, 'data', 'checks.json');
const logPath = path.join(root, 'logs', 'health.log');
const timeout = 8000;
const concurrency = 5;
const failLimit = 3;

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const history = fs.existsSync(checksPath) ? JSON.parse(fs.readFileSync(checksPath, 'utf8')) : {};
const now = new Date().toISOString();

const agent = 'Mozilla/5.0 (compatible; ExamHiveHealthCheck/1.0)';

async function ping(url) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const options = { redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': agent } };
  try {
    let response = await fetch(url, { ...options, method: 'HEAD' });
    if ([403, 405, 501].includes(response.status)) {
      response = await fetch(url, { ...options, method: 'GET', headers: { ...options.headers, Range: 'bytes=0-1023' } });
    }
    return { ok: response.status < 400, code: response.status, ms: Date.now() - started };
  } catch (error) {
    return { ok: false, code: 0, ms: Date.now() - started, error: error.name };
  } finally {
    clearTimeout(timer);
  }
}

async function check(link) {
  let result;
  if (!link.url || link.url.startsWith('mailto:')) {
    result = { ok: true, code: 200, ms: 0 };
  } else if (/^https?:\/\//.test(link.url)) {
    result = await ping(link.url);
  } else {
    const file = path.resolve(root, link.url);
    const ok = fs.existsSync(file);
    result = { ok, code: ok ? 200 : 404, ms: 0 };
  }

  let status;
  if (!result.ok) status = result.code === 403 || result.code === 405 ? 'slow' : 'down';
  else status = result.ms > 3000 ? 'slow' : 'working';
  if (result.code === 403 || result.code === 405) status = 'slow';

  const previous = history[link.id] || { failures: 0, history: [] };
  const failures = status === 'down' ? (previous.failures || 0) + 1 : 0;
  history[link.id] = {
    failures,
    history: [{ at: now, status, code: result.code, ms: result.ms }, ...(previous.history || [])].slice(0, 24)
  };

  link.status = status;
  link.lastChecked = now;
  link.failures = failures;
  link.hidden = failures >= failLimit;
  if (status === 'down' && !link.note) link.note = `Failed ${failures} of ${failLimit} checks.`;
  if (status !== 'down' && link.note && link.note.startsWith('Failed ')) delete link.note;

  return { id: link.id, status, code: result.code, ms: result.ms, failures, hidden: link.hidden };
}

async function run() {
  const queue = registry.links.slice();
  const results = [];
  async function worker() {
    while (queue.length) {
      const link = queue.shift();
      const outcome = await check(link);
      results.push(outcome);
      console.log(`${outcome.status.padEnd(7)} ${String(outcome.code).padStart(3)} ${String(outcome.ms).padStart(5)}ms  ${outcome.id}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  registry.meta.checkedAt = now;
  registry.meta.lastRun = { checked: results.length, working: results.filter((r) => r.status === 'working').length, down: results.filter((r) => r.status === 'down').length };
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
  fs.writeFileSync(checksPath, JSON.stringify(history, null, 2) + '\n');

  const summary = `${now} checked=${results.length} working=${results.filter((r) => r.status === 'working').length} slow=${results.filter((r) => r.status === 'slow').length} down=${results.filter((r) => r.status === 'down').length} hidden=${results.filter((r) => r.hidden).length}`;
  fs.appendFileSync(logPath, summary + '\n');
  console.log('\n' + summary);
  console.log('Run on a cron: 0 */4 * * * cd ' + root + ' && npm run health');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
