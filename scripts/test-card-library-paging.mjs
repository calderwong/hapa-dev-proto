import { writeFileSync } from 'node:fs';

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

function stableStringify(value) {
  const sortDeep = (v) => {
    if (!v || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(sortDeep);
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortDeep(v[k]);
    return out;
  };

  try {
    return JSON.stringify(sortDeep(value), null, 2);
  } catch {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
}

function diffObject(prev, next, keys) {
  const diff = {};
  for (const k of keys) {
    const a = prev ? prev[k] : undefined;
    const b = next ? next[k] : undefined;
    const same = (() => {
      if (a === b) return true;
      try {
        return JSON.stringify(a) === JSON.stringify(b);
      } catch {
        return false;
      }
    })();
    if (!same) diff[k] = { from: a, to: b };
  }
  return diff;
}

function getArgValue(args, name) {
  if (!Array.isArray(args) || !name) return null;
  const i = args.indexOf(name);
  if (i >= 0) return typeof args[i + 1] === 'string' ? args[i + 1] : '';
  const pref = `${name}=`;
  const hit = args.find((v) => typeof v === 'string' && v.startsWith(pref));
  return hit ? hit.slice(pref.length) : null;
}

function toInt(value, fallback) {
  const raw = typeof value === 'string' ? value.trim() : value;
  const parsed = Number.parseInt(String(raw), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function deriveDropped({ cardsCount, indexCursor, indexTotalLength } = {}) {
  const cc = typeof cardsCount === 'number' ? cardsCount : null;
  const cur = typeof indexCursor === 'number' ? indexCursor : null;
  const total = typeof indexTotalLength === 'number' ? indexTotalLength : null;
  return {
    byTotalLength: typeof total === 'number' && typeof cc === 'number' ? total - cc : null,
    byCursor: typeof cur === 'number' && typeof cc === 'number' ? cur - cc : null,
  };
}

function getDiagnosticsCardLibrary(snapshot) {
  const cardLibrary = snapshot && snapshot.cardLibrary ? snapshot.cardLibrary : null;
  const sqlite = cardLibrary && cardLibrary.sqlite ? cardLibrary.sqlite : null;
  const sqliteStats = sqlite && sqlite.stats ? sqlite.stats : null;
  const paging = cardLibrary && cardLibrary.paging ? cardLibrary.paging : null;

  return {
    coreName: cardLibrary ? cardLibrary.coreName : null,
    hypercoreLength: cardLibrary ? cardLibrary.hypercoreLength : null,
    sqlite: {
      caughtUp: sqlite ? sqlite.caughtUp : null,
      checkpoint: sqlite ? sqlite.checkpoint : null,
      cardCount: sqliteStats ? sqliteStats.cardCount : null,
    },
    paging: {
      mode: paging ? paging.mode : null,
      reason: paging ? paging.reason : null,
    },
  };
}

function getUiCardLibrary(rendererState) {
  const debug = rendererState && rendererState.renderer ? rendererState.renderer.debugState : null;
  const card = debug && debug.cardLibrary ? debug.cardLibrary : null;
  if (!card) return null;

  return pick(card, [
    'active',
    'mountedAt',
    'updatedAt',
    'cardsCount',
    'indexCursor',
    'indexHasMore',
    'indexTotalLength',
    'isFetchingMore',
    'lastInitialIndexPage',
    'lastRequestMoreResponse',
    'lastRequestMoreAttempt',
    'requestMoreAttempts',
  ]);
}

async function scrollVirtualGrid({ to, top, delta } = {}) {
  const params = new URLSearchParams();
  if (to) params.set('to', String(to));
  if (typeof top === 'number' && Number.isFinite(top)) params.set('top', String(Math.round(top)));
  if (typeof delta === 'number' && Number.isFinite(delta)) params.set('delta', String(Math.round(delta)));
  try {
    const res = await getJson(`/v1/renderer/scroll-virtual-grid?${params.toString()}`);
    return res && res.scrollVirtualGrid ? res.scrollVirtualGrid : null;
  } catch (err) {
    const msg = err && err.message ? String(err.message) : String(err);
    const details = err && err.details ? err.details : null;
    const notFound =
      (details && details.ok === false && details.error === 'not_found') ||
      msg.toLowerCase().includes('http 404');
    if (notFound) {
      const e = new Error(
        'Debug API endpoint /v1/renderer/scroll-virtual-grid not found. Restart the app so the updated Debug API is running.',
      );
      e.details = details;
      throw e;
    }
    throw err;
  }
}

async function captureTruthPacket(label) {
  const diag = await getJson('/v1/ipc/diagnostics-snapshot');
  await sleep(250);
  const renderer = await getJson('/v1/renderer/state');

  const snapshot = diag?.diagnosticsSnapshot?.value?.snapshot || diag?.diagnosticsSnapshot?.snapshot || null;

  return {
    label,
    at: new Date().toISOString(),
    diagnostics: getDiagnosticsCardLibrary(snapshot),
    ui: getUiCardLibrary(renderer),
  };
}

async function main() {
  console.log('[card-library-paging-test] baseUrl:', baseUrl);

  const args = process.argv.slice(2);
  const pageSize = toInt(process.env.HAPA_PAGING_PAGE_SIZE || getArgValue(args, '--pageSize'), 120);
  const maxPages = toInt(process.env.HAPA_PAGING_MAX_PAGES || getArgValue(args, '--maxPages'), 10);
  const targetDelta = toInt(process.env.HAPA_PAGING_TARGET_DELTA || getArgValue(args, '--targetDelta'), 600);
  const reportPath = process.env.HAPA_PAGING_REPORT_PATH || getArgValue(args, '--reportPath');
  const includePages =
    Boolean(reportPath) ||
    String(process.env.HAPA_PAGING_INCLUDE_PAGES || '').trim() === '1' ||
    args.includes('--includePages');
  const requireFreshStart =
    String(process.env.HAPA_PAGING_REQUIRE_FRESH_START || '').trim() === '1' || args.includes('--requireFreshStart');
  const maxStartCardsCount = toInt(
    process.env.HAPA_PAGING_MAX_START_CARDS_COUNT || getArgValue(args, '--maxStartCardsCount'),
    240,
  );

  const health = await getJson('/health', { auth: false });
  console.log('[health]', health);

  const info = await getJson('/v1/info');
  console.log('[info]', pick(info, ['ok', 'pid', 'platform']));

  console.log('[navigate] -> /cards');
  const nav = await getJson('/v1/renderer/navigate?path=/cards');
  console.log('[navigate]', nav.navigate);

  await sleep(350);

  console.log('[wait] cardLibrary.active');
  let activeState = await poll(
    async () => {
      const s = await getJson('/v1/renderer/state');
      const card = s?.renderer?.debugState?.cardLibrary;
      if (!card || !card.active) return null;
      return s;
    },
    { timeoutMs: 45000, intervalMs: 600 },
  );

  if (!activeState) {
    const state = await getJson('/v1/renderer/state');
    const diag = await getJson('/v1/ipc/diagnostics-snapshot');
    const snapshot = diag?.diagnosticsSnapshot?.value?.snapshot || diag?.diagnosticsSnapshot?.snapshot || null;
    console.error('[FAIL] cardLibrary did not become active within timeout');
    console.error(JSON.stringify({
      navigate: nav?.navigate || null,
      diagnostics: snapshot ? getDiagnosticsCardLibrary(snapshot) : (diag?.diagnosticsSnapshot || null),
      renderer: pick(state?.renderer, ['available', 'href', 'hash', 'title', 'error', 'loading']),
      debugStateKeys: state?.renderer?.debugState ? Object.keys(state.renderer.debugState) : null,
      cardLibrary: state?.renderer?.debugState?.cardLibrary || null,
    }, null, 2));
    process.exit(2);
  }

  let activeUi = getUiCardLibrary(activeState);
  const activeCardsCount = typeof activeUi?.cardsCount === 'number' ? activeUi.cardsCount : null;
  const activeTotal = typeof activeUi?.indexTotalLength === 'number' ? activeUi.indexTotalLength : null;
  const dropped = deriveDropped({
    cardsCount: activeCardsCount,
    indexCursor: activeUi?.indexCursor,
    indexTotalLength: activeTotal,
  });

  if (requireFreshStart && typeof activeCardsCount === 'number' && activeCardsCount > maxStartCardsCount) {
    console.log('[reset] stale cardLibrary state; attempting soft reset');
    await getJson('/v1/renderer/navigate?path=/library');
    await sleep(400);
    await getJson('/v1/renderer/navigate?path=/cards');

    const freshState = await poll(
      async () => {
        const s = await getJson('/v1/renderer/state');
        const card = s?.renderer?.debugState?.cardLibrary;
        const cc = card && typeof card.cardsCount === 'number' ? card.cardsCount : null;
        if (!card || !card.active) return null;
        if (typeof cc === 'number' && cc <= maxStartCardsCount) return s;
        return null;
      },
      { timeoutMs: 45000, intervalMs: 600 },
    );

    if (!freshState) {
      const state = await getJson('/v1/renderer/state');
      console.error('[FAIL] unable to reach fresh /cards state (cardsCount <= maxStartCardsCount). Full restart required.');
      console.error(JSON.stringify({
        maxStartCardsCount,
        renderer: pick(state?.renderer, ['available', 'href', 'hash', 'title', 'error', 'loading']),
        cardLibrary: state?.renderer?.debugState?.cardLibrary || null,
      }, null, 2));
      process.exit(2);
    }

    activeState = freshState;
    activeUi = getUiCardLibrary(activeState);
  }

  // Defensive remount: if we start with the scroller already near-bottom but maxScrollTop is tiny,
  // VirtualCardGrid might never cross the threshold to trigger onRequestMore. Bounce the route once.
  const initialScroller = activeState?.renderer?.virtualGridScroller || null;
  const initialMaxScrollTop =
    initialScroller &&
    typeof initialScroller.scrollHeight === 'number' &&
    typeof initialScroller.clientHeight === 'number'
      ? Math.max(0, initialScroller.scrollHeight - initialScroller.clientHeight)
      : null;
  const needsScrollerReset =
    typeof initialMaxScrollTop === 'number' &&
    initialMaxScrollTop <= 120 &&
    typeof initialScroller?.scrollTop === 'number' &&
    initialScroller.scrollTop > 0 &&
    typeof activeUi?.cardsCount === 'number' &&
    activeUi.cardsCount >= pageSize;

  if (needsScrollerReset) {
    console.log('[reset] scroller near-bottom with tiny maxScrollTop; remounting /cards');
    await getJson('/v1/renderer/navigate?path=/library');
    await sleep(400);
    await getJson('/v1/renderer/navigate?path=/cards');

    const remountedState = await poll(
      async () => {
        const s = await getJson('/v1/renderer/state');
        const card = s?.renderer?.debugState?.cardLibrary;
        const scroller = s?.renderer?.virtualGridScroller || null;
        const maxScrollTop =
          scroller &&
          typeof scroller.scrollHeight === 'number' &&
          typeof scroller.clientHeight === 'number'
            ? Math.max(0, scroller.scrollHeight - scroller.clientHeight)
            : null;

        if (!card || !card.active) return null;
        if (typeof card.cardsCount !== 'number') return null;
        // Require the scroller to be at/near top OR to have a reasonable scroll range.
        const scrollerAtTop =
          scroller && typeof scroller.scrollTop === 'number' ? scroller.scrollTop <= 1 : true;
        const scrollRangeOk = typeof maxScrollTop === 'number' ? maxScrollTop > 120 : true;
        if (!scrollerAtTop && !scrollRangeOk) return null;
        return s;
      },
      { timeoutMs: 45000, intervalMs: 600 },
    );

    if (!remountedState) {
      const state = await getJson('/v1/renderer/state');
      console.error('[FAIL] remount did not yield a sane scroller state; aborting');
      console.error(
        JSON.stringify(
          {
            initialMaxScrollTop,
            initialScrollTop: initialScroller?.scrollTop ?? null,
            renderer: pick(state?.renderer, ['available', 'href', 'hash', 'title', 'error', 'loading']),
            cardLibrary: state?.renderer?.debugState?.cardLibrary || null,
            scroller: state?.renderer?.virtualGridScroller || null,
          },
          null,
          2,
        ),
      );
      process.exit(2);
    }

    activeState = remountedState;
    activeUi = getUiCardLibrary(activeState);
  }

  const scrollerSelector = '[data-virtual-grid-scroll-container="true"]';
  const domParams = new URLSearchParams({ selector: scrollerSelector });
  const domRes = await getJson(`/v1/renderer/dom?${domParams.toString()}`);
  const domScroller = domRes && domRes.dom ? domRes.dom : null;
  console.log('[dom]', {
    selector: scrollerSelector,
    count: domScroller && typeof domScroller.count === 'number' ? domScroller.count : null,
    exists: domScroller && typeof domScroller.exists === 'boolean' ? domScroller.exists : null,
    error: domScroller && domScroller.error ? domScroller.error : null,
    chosen: domScroller && typeof domScroller.count === 'number' && domScroller.count > 0 ? 'first' : null,
  });

  const t0 = await captureTruthPacket('T0');

  // Paging loop
  const pages = [];

  const startUi = t0.ui;
  const startCount = typeof startUi?.cardsCount === 'number' ? startUi.cardsCount : null;
  const startTotal = typeof startUi?.indexTotalLength === 'number' ? startUi.indexTotalLength : null;
  const effectiveTarget =
    typeof startCount === 'number'
      ? (typeof startTotal === 'number' ? Math.min(startCount + targetDelta, startTotal) : startCount + targetDelta)
      : (typeof startTotal === 'number' ? Math.min(targetDelta, startTotal) : targetDelta);

  let prevUi = t0.ui;

  const pulsePercents = [0.8, 0.95, 0.99];
  let lastSeenRequestMoreAttempt = prevUi?.lastRequestMoreAttempt || null;
  let lastSeenRequestMoreResponse = prevUi?.lastRequestMoreResponse || null;
  let noDeltaStreak = 0;
  let stallPacket = null;

  for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
    const attemptStartRaw = await getJson('/v1/renderer/state');
    const attemptStartUi = getUiCardLibrary(attemptStartRaw);

    const uiCardsCount = typeof attemptStartUi?.cardsCount === 'number' ? attemptStartUi.cardsCount : null;
    const uiCursor = typeof attemptStartUi?.indexCursor === 'number' ? attemptStartUi.indexCursor : null;
    const uiHasMore = typeof attemptStartUi?.indexHasMore === 'boolean' ? attemptStartUi.indexHasMore : null;
    const uiTotal = typeof attemptStartUi?.indexTotalLength === 'number' ? attemptStartUi.indexTotalLength : null;

    if (typeof uiCardsCount === 'number' && uiCardsCount >= effectiveTarget) {
      break;
    }
    if (uiHasMore === false) {
      if (typeof uiCursor === 'number' && typeof uiTotal === 'number' && uiCursor >= uiTotal) {
        break;
      }
      break;
    }

    const attemptStartAttempts =
      typeof attemptStartUi?.requestMoreAttempts === 'number' ? attemptStartUi.requestMoreAttempts : null;
    const attemptStartCount = typeof attemptStartUi?.cardsCount === 'number' ? attemptStartUi.cardsCount : null;
    const attemptStartCursor = typeof attemptStartUi?.indexCursor === 'number' ? attemptStartUi.indexCursor : null;

    const page = {
      pageNo,
      pageSize,
      pulses: [],
      wheel: [],
    };

    let currentRaw = attemptStartRaw;
    let currentUi = attemptStartUi;

    // Wheel pulses first (simulate real user scroll). Three pulses of deltaY=800.
    const wheelResults = [];
    const beforeWheelAttempts = attemptStartAttempts;
    const beforeWheelCards = attemptStartCount;
    for (let w = 0; w < 3; w += 1) {
      const wheelRes = await scrollVirtualGrid({ mode: 'wheel', deltaY: 800 });
      wheelResults.push(wheelRes && wheelRes.available ? wheelRes.value || wheelRes : wheelRes);
      await sleep(250);
    }
    const afterWheelRaw = await getJson('/v1/renderer/state');
    const afterWheelUi = getUiCardLibrary(afterWheelRaw);
    const afterWheelAttempts =
      typeof afterWheelUi?.requestMoreAttempts === 'number' ? afterWheelUi.requestMoreAttempts : null;
    const afterWheelCount = typeof afterWheelUi?.cardsCount === 'number' ? afterWheelUi.cardsCount : null;
    const wheelAttemptsDelta =
      typeof afterWheelAttempts === 'number' && typeof beforeWheelAttempts === 'number'
        ? afterWheelAttempts - beforeWheelAttempts
        : null;
    const wheelCardsDelta =
      typeof afterWheelCount === 'number' && typeof beforeWheelCards === 'number'
        ? afterWheelCount - beforeWheelCards
        : null;

    page.wheel.push({
      pulses: wheelResults,
      summary: {
        beforeAttempts: beforeWheelAttempts,
        afterAttempts: afterWheelAttempts,
        wheelAttemptsDelta,
        beforeCards: beforeWheelCards,
        afterCards: afterWheelCount,
        wheelCardsDelta,
      },
    });

    currentRaw = afterWheelRaw;
    currentUi = afterWheelUi;

    const wheelProgressed =
      typeof wheelAttemptsDelta === 'number' ? wheelAttemptsDelta > 0 : typeof wheelCardsDelta === 'number' ? wheelCardsDelta > 0 : false;

    for (let pulseIndex = 0; pulseIndex < pulsePercents.length; pulseIndex += 1) {
      const percent = pulsePercents[pulseIndex];
      const pulseNo = pulseIndex + 1;

      const beforeRaw = currentRaw;
      const beforeUi = currentUi;
      const beforeScroller = beforeRaw?.renderer?.virtualGridScroller || null;
      const beforeAttempts = typeof beforeUi?.requestMoreAttempts === 'number' ? beforeUi.requestMoreAttempts : null;

      // Capture DOM candidates before scrolling to detect multiple scrollers and the chosen candidate.
      const domBeforeRes = await getJson(`/v1/renderer/dom?${domParams.toString()}`);
      const domBefore =
        domBeforeRes && domBeforeRes.dom
          ? pick(domBeforeRes.dom, ['selector', 'count', 'exists', 'hasAnyScrollable', 'chooseCandidateIndex', 'items'])
          : domBeforeRes;

      const maxScrollTop =
        beforeScroller && typeof beforeScroller.scrollHeight === 'number' && typeof beforeScroller.clientHeight === 'number'
          ? Math.max(0, beforeScroller.scrollHeight - beforeScroller.clientHeight)
          : null;
      const targetTop = typeof maxScrollTop === 'number' ? Math.round(maxScrollTop * percent) : null;

      const scrollRes =
        typeof targetTop === 'number' ? await scrollVirtualGrid({ top: targetTop }) : await scrollVirtualGrid({ to: 'near-bottom' });
      const scrollInfo =
        scrollRes && scrollRes.available
          ? (typeof scrollRes.value !== 'undefined'
              ? scrollRes.value
              : { ok: false, error: scrollRes.error || 'unknown' })
          : scrollRes;

      await sleep(250);

      const afterRaw = await getJson('/v1/renderer/state');
      const afterUi = getUiCardLibrary(afterRaw);
      const afterScroller = afterRaw?.renderer?.virtualGridScroller || null;

      const afterAttempts = typeof afterUi?.requestMoreAttempts === 'number' ? afterUi.requestMoreAttempts : null;
      const requestMoreAttemptsDelta =
        typeof afterAttempts === 'number' && typeof beforeAttempts === 'number' ? afterAttempts - beforeAttempts : null;
      const requestMoreAttemptsIncremented =
        typeof requestMoreAttemptsDelta === 'number' ? requestMoreAttemptsDelta > 0 : null;

      const nextAttempt = afterUi?.lastRequestMoreAttempt || null;
      const nextResponse = afterUi?.lastRequestMoreResponse || null;

      const attemptChanged = (() => {
        try {
          return JSON.stringify(nextAttempt) !== JSON.stringify(lastSeenRequestMoreAttempt);
        } catch {
          return nextAttempt !== lastSeenRequestMoreAttempt;
        }
      })();
      const responseChanged = (() => {
        try {
          return JSON.stringify(nextResponse) !== JSON.stringify(lastSeenRequestMoreResponse);
        } catch {
          return nextResponse !== lastSeenRequestMoreResponse;
        }
      })();

      if (attemptChanged) lastSeenRequestMoreAttempt = nextAttempt;
      if (responseChanged) lastSeenRequestMoreResponse = nextResponse;

      page.pulses.push({
        pulseNo,
        percent,
        maxScrollTop,
        targetTop,
        scroll: scrollInfo,
        scrollerBefore: pick(beforeScroller, ['scrollTop', 'scrollHeight', 'clientHeight', 'atBottom']),
        scrollerAfter: pick(afterScroller, ['scrollTop', 'scrollHeight', 'clientHeight', 'atBottom']),
        uiBefore: pick(beforeUi, ['cardsCount', 'indexCursor', 'indexHasMore', 'isFetchingMore', 'requestMoreAttempts']),
        uiAfter: pick(afterUi, ['cardsCount', 'indexCursor', 'indexHasMore', 'isFetchingMore', 'requestMoreAttempts']),
        requestMoreAttemptsDelta,
        requestMoreAttemptsIncremented,
        lastRequestMoreAttempt: attemptChanged ? nextAttempt : undefined,
        lastRequestMoreResponse: responseChanged ? nextResponse : undefined,
        domBefore,
      });

      currentRaw = afterRaw;
      currentUi = afterUi;
    }

    const attemptEndAttempts = typeof currentUi?.requestMoreAttempts === 'number' ? currentUi.requestMoreAttempts : null;
    const attemptEndCount = typeof currentUi?.cardsCount === 'number' ? currentUi.cardsCount : null;
    const attemptEndCursor = typeof currentUi?.indexCursor === 'number' ? currentUi.indexCursor : null;
    const attemptProgressed =
      typeof attemptStartAttempts === 'number' && typeof attemptEndAttempts === 'number'
        ? attemptEndAttempts > attemptStartAttempts
        : typeof attemptStartCount === 'number' && typeof attemptEndCount === 'number'
          ? attemptEndCount > attemptStartCount
          : null;
    const attemptAttemptsDelta =
      typeof attemptEndAttempts === 'number' && typeof attemptStartAttempts === 'number'
        ? attemptEndAttempts - attemptStartAttempts
        : null;
    const attemptCardsDelta =
      typeof attemptEndCount === 'number' && typeof attemptStartCount === 'number' ? attemptEndCount - attemptStartCount : null;
    const attemptCursorDelta =
      typeof attemptEndCursor === 'number' && typeof attemptStartCursor === 'number'
        ? attemptEndCursor - attemptStartCursor
        : null;

    page.summary = {
      start: pick(attemptStartUi, ['cardsCount', 'indexCursor', 'indexHasMore', 'isFetchingMore', 'requestMoreAttempts']),
      end: pick(currentUi, ['cardsCount', 'indexCursor', 'indexHasMore', 'isFetchingMore', 'requestMoreAttempts']),
      cardsCountDelta: attemptCardsDelta,
      indexCursorDelta: attemptCursorDelta,
      requestMoreAttemptsDelta: attemptAttemptsDelta,
    };

    pages.push(page);
    prevUi = currentUi;

    const progressed =
      wheelProgressed ||
      (typeof attemptCardsDelta === 'number'
        ? attemptCardsDelta > 0
        : typeof attemptCursorDelta === 'number'
          ? attemptCursorDelta > 0
          : false);

    if (!progressed) noDeltaStreak += 1;
    else noDeltaStreak = 0;

    if (!stallPacket && noDeltaStreak >= 2) {
      const stallRaw = await getJson('/v1/renderer/state');
      const stallUi = getUiCardLibrary(stallRaw);
      const stallScroller = stallRaw?.renderer?.virtualGridScroller || null;
      stallPacket = {
        domScrollerCount: domScroller && typeof domScroller.count === 'number' ? domScroller.count : null,
        chosenScroller: 'first',
        scroller: pick(stallScroller, ['scrollTop', 'scrollHeight', 'clientHeight', 'atBottom']),
        ui: pick(stallUi, ['cardsCount', 'indexCursor', 'indexHasMore', 'isFetchingMore', 'requestMoreAttempts']),
        lastRequestMoreAttempt: stallUi?.lastRequestMoreAttempt || null,
        lastRequestMoreAttemptSkipReason: stallUi?.lastRequestMoreAttempt?.skipReason || null,
        lastRequestMoreResponse: stallUi?.lastRequestMoreResponse || null,
      };
      console.log('[stall]');
      console.log(stableStringify(stallPacket));
      break;
    }
  }

  const t1 = await captureTruthPacket('T1');

  const uiEnd = t1.ui;
  const endCount = typeof uiEnd?.cardsCount === 'number' ? uiEnd.cardsCount : null;
  const endCursor = typeof uiEnd?.indexCursor === 'number' ? uiEnd.indexCursor : null;
  const endTotal = typeof uiEnd?.indexTotalLength === 'number' ? uiEnd.indexTotalLength : null;
  const endHasMore = typeof uiEnd?.indexHasMore === 'boolean' ? uiEnd.indexHasMore : null;

  const reachedTarget = typeof endCount === 'number' ? endCount >= effectiveTarget : false;
  const reachedEndOfListTruth =
    endHasMore === false &&
    typeof endCursor === 'number' &&
    typeof endTotal === 'number' &&
    endCursor >= endTotal;

  const status = reachedTarget || reachedEndOfListTruth ? 'PASS' : 'FAIL';

  let causeCandidate = null;
  if (endHasMore === false && typeof endCursor === 'number' && typeof endTotal === 'number' && endCursor < endTotal) {
    causeCandidate = 'ui_index_has_more_false_before_total_cursor';
  } else if (!reachedTarget && !reachedEndOfListTruth) {
    causeCandidate = 'ui_cards_count_did_not_reach_target_delta_within_max_pages';
  }

  const smallestDiff = diffObject(t0, t1, ['diagnostics', 'ui']);

  const droppedT0 = deriveDropped(t0.ui);
  const droppedT1 = deriveDropped(t1.ui);

  const pagesTail = pages.length > 0 ? pages.slice(Math.max(0, pages.length - 2)) : [];

  const report = {
    status,
    baseUrl,
    target: {
      targetDelta,
      effectiveTarget,
      maxPages,
      pageSize,
      maxStartCardsCount,
    },
    derived: {
      reachedTarget,
      reachedEndOfListTruth,
      dropped: {
        t0: droppedT0,
        t1: droppedT1,
      },
    },
    t0,
    pagesCount: pages.length,
    pagesTail,
    pages: includePages ? pages : undefined,
    t1,
    fail: status === 'FAIL' ? { causeCandidate, smallestDiff } : null,
  };

  // Single concise report
  const reportJson = stableStringify(report);

  console.log('[report]');
  console.log(reportJson);

  if (reportPath) {
    try {
      writeFileSync(reportPath, `${reportJson}\n`);
    } catch (err) {
      console.error('[ERROR] write reportPath failed:', reportPath);
      console.error(err && err.message ? err.message : String(err));
    }
  }

  if (status !== 'PASS') process.exit(2);
}

main().catch((err) => {
  console.error('[ERROR]', err.message || String(err));
  if (err.details) console.error(JSON.stringify(err.details, null, 2));
  process.exit(1);
});
