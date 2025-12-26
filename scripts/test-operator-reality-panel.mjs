const baseUrl = process.env.HAPA_DEBUG_API_BASE_URL || 'http://127.0.0.1:46830';
const token = process.env.HAPA_DEBUG_API_TOKEN;

if (!token) {
  console.error('Missing env var: HAPA_DEBUG_API_TOKEN');
  console.error('Example:');
  console.error('  $env:HAPA_DEBUG_API_BASE_URL="http://127.0.0.1:46830"');
  console.error('  $env:HAPA_DEBUG_API_TOKEN="local-dev"');
  process.exit(1);
}

const authHeaders = {
  Authorization: `Bearer ${token}`,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(path, { auth = true } = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: auth ? authHeaders : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} for ${url}`);
    err.details = json;
    throw err;
  }
  return json;
}

async function poll(fn, { timeoutMs = 10000, intervalMs = 350 } = {}) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - start > timeoutMs) return null;
    await sleep(intervalMs);
  }
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) out[k] = obj && Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : undefined;
  return out;
}

async function main() {
  console.log('[operator-panel-test] baseUrl:', baseUrl);

  const health = await getJson('/health', { auth: false });
  console.log('[health]', health);

  const info = await getJson('/v1/info');
  console.log('[info]', pick(info, ['ok', 'pid', 'platform']));

  console.log('[wait] renderer responsive');
  const rendererReady = await poll(
    async () => {
      const state = await getJson('/v1/renderer/state');
      const renderer = state && state.renderer ? state.renderer : null;
      if (!renderer || !renderer.available) return null;
      if (renderer.error) return null;
      return state;
    },
    { timeoutMs: 90000, intervalMs: 600 },
  );

  if (!rendererReady) {
    const state = await getJson('/v1/renderer/state');
    console.error('[FAIL] renderer not responsive within timeout');
    console.error(JSON.stringify(state.renderer, null, 2));
    process.exit(2);
  }

  console.log('[navigate] -> /operator');
  const nav = await poll(
    async () => {
      const res = await getJson('/v1/renderer/navigate?path=/operator');
      return res && res.navigate && res.navigate.value && res.navigate.value.ok ? res : null;
    },
    { timeoutMs: 15000, intervalMs: 600 },
  );

  if (!nav) {
    const state = await getJson('/v1/renderer/state');
    console.error('[FAIL] navigate timeout');
    console.error(JSON.stringify(state.renderer, null, 2));
    process.exit(2);
  }

  console.log('[navigate]', nav.navigate);

  console.log('[wait] operator panel mounted + snapshot');
  const ready = await poll(
    async () => {
      const res = await getJson('/v1/checks/operator-panel-ready?requireSnapshot=true');
      return res && res.result ? res : null;
    },
    { timeoutMs: 30000, intervalMs: 600 },
  );

  if (!ready) {
    const state = await getJson('/v1/renderer/state');
    console.error('[FAIL] operator panel not ready within timeout');
    console.error(JSON.stringify(state.renderer, null, 2));
    process.exit(2);
  }

  console.log('[ready]', {
    active: ready.active,
    hasSnapshot: ready.hasSnapshot,
    lastAction: ready.operatorRealityPanel?.lastAction,
    updatedAt: ready.operatorRealityPanel?.updatedAt,
  });

  const systemStats = await getJson('/v1/ipc/system-stats');
  console.log('[system-stats]', systemStats.systemStats?.value?.ok ? 'ok' : systemStats.systemStats);

  const persistenceStats = await getJson('/v1/ipc/persistence-stats');
  console.log('[persistence-stats]', persistenceStats.persistenceStats?.value?.ok ? 'ok' : persistenceStats.persistenceStats);

  console.log('[click] Copy JSON');
  await getJson('/v1/renderer/click?text=Copy%20JSON');
  await sleep(400);

  console.log('[click] Download JSON');
  await getJson('/v1/renderer/click?text=Download%20JSON');
  await sleep(400);

  console.log('[rebuild] persistence-rebuild-card-library-index (IPC)');
  const rebuild = await getJson('/v1/ipc/persistence-rebuild-card-library-index');
  console.log('[rebuild]', rebuild.persistenceRebuildCardLibraryIndex);

  console.log('[click] Refresh');
  await getJson('/v1/renderer/click?text=Refresh');

  const after = await getJson('/v1/renderer/state');
  const panel = after.renderer?.debugState?.operatorRealityPanel;
  console.log('[panel-debug]', {
    active: panel?.active,
    lastAction: panel?.lastAction,
    status: panel?.status,
    error: panel?.error,
    snapshotTime: panel?.snapshot?.time,
  });

  console.log('[PASS] Operator Reality Panel smoke test completed');
}

main().catch((err) => {
  console.error('[ERROR]', err.message || String(err));
  if (err.details) console.error(JSON.stringify(err.details, null, 2));
  process.exit(1);
});
