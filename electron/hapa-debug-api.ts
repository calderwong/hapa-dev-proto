import * as http from 'http';
import { randomBytes } from 'crypto';
import type { BrowserWindow } from 'electron';

export type HapaDebugApiHandle = {
  port: number;
  token: string;
  baseUrl: string;
  close: () => Promise<void>;
};

type StartHapaDebugApiOptions = {
  getMainWindow: () => BrowserWindow | null;
  port?: number;
  token?: string;
};

const isLocalAddress = (addr: string): boolean => {
  const normalized = String(addr || '').trim();
  return (
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '::ffff:127.0.0.1' ||
    normalized.endsWith('127.0.0.1')
  );
};

const getBearerToken = (req: http.IncomingMessage): string | null => {
  const auth = req.headers.authorization;
  if (!auth || typeof auth !== 'string') return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1]?.trim() || null : null;
};

const sendJson = (res: http.ServerResponse, status: number, payload: any) => {
  const body = JSON.stringify(payload ?? null);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(body);
};

const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const getRendererSnapshot = async (win: BrowserWindow | null) => {
  if (!win || win.isDestroyed()) {
    return { available: false, error: 'main_window_unavailable' };
  }

  const href = (() => {
    try {
      return win.webContents.getURL();
    } catch {
      return '';
    }
  })();

  const isLoading = (() => {
    try {
      return win.webContents.isLoading();
    } catch {
      return false;
    }
  })();

  if (!href || href === 'about:blank') {
    return { available: true, href, loading: true, error: 'loading' };
  }

  if (isLoading) {
    return { available: true, href, loading: true, error: 'loading' };
  }

  try {
    const value = await withTimeout(
      win.webContents.executeJavaScript(
        `(() => {
          const state = (typeof window !== 'undefined' && window.__HAPA_DEBUG_STATE__) ? window.__HAPA_DEBUG_STATE__ : null;
          const scroller = document.querySelector('[data-virtual-grid-scroll-container="true"]');
          const scrollerMetrics = scroller ? (() => {
            try {
              const r = scroller.getBoundingClientRect();
              return {
                scrollTop: scroller.scrollTop,
                scrollHeight: scroller.scrollHeight,
                clientHeight: scroller.clientHeight,
                rect: { x: r.x, y: r.y, width: r.width, height: r.height },
                atBottom: scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2,
              };
            } catch {
              return null;
            }
          })() : null;
          return {
            href: location.href,
            pathname: location.pathname,
            hash: location.hash,
            title: document.title,
            hasVirtualGridScroller: !!scroller,
            virtualGridScroller: scrollerMetrics,
            debugState: state,
          };
        })()`,
        true,
      ),
      20000,
    );

    return { available: true, ...value };
  } catch (err: any) {
    return { available: true, error: err?.message || String(err) };
  }
};

const runDomQuery = async (win: BrowserWindow | null, selector: string) => {
  if (!win || win.isDestroyed()) {
    return { available: false, error: 'main_window_unavailable' };
  }

  const safeSelector = String(selector || '').trim();
  if (!safeSelector) {
    return { available: true, selector: safeSelector, error: 'selector_required' };
  }

  if (safeSelector.length > 250) {
    return { available: true, selector: safeSelector.slice(0, 250), error: 'selector_too_long' };
  }

  try {
    if (win.webContents.isLoading()) {
      return { available: true, selector: safeSelector, error: 'loading' };
    }
  } catch {
  }

  try {
    const value = await withTimeout(
      win.webContents.executeJavaScript(
        `(() => {
          const selector = ${JSON.stringify(safeSelector)};
          try {
            const nodes = Array.from(document.querySelectorAll(selector));
            const count = nodes.length;
            const items = nodes.slice(0, 3).map((el, idx) => {
              try {
                const r = el.getBoundingClientRect();
                const scrollHeight = el.scrollHeight ?? null;
                const clientHeight = el.clientHeight ?? null;
                const scrollTop = el.scrollTop ?? null;
                const area = r ? r.width * r.height : null;
                const scrollable =
                  typeof scrollHeight === 'number' &&
                  typeof clientHeight === 'number' &&
                  scrollHeight > clientHeight + 2;
                return {
                  index: idx,
                  rect: r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null,
                  scrollHeight,
                  clientHeight,
                  scrollTop,
                  atBottom:
                    typeof scrollTop === 'number' &&
                    typeof clientHeight === 'number' &&
                    typeof scrollHeight === 'number'
                      ? scrollTop + clientHeight >= scrollHeight - 2
                      : null,
                  area,
                  scrollable,
                };
              } catch {
                return { index: idx, error: 'metric_error' };
              }
            });

            const scrollableCandidates = items.filter((it) => it && it.scrollable && typeof it.area === 'number');
            const chosen =
              scrollableCandidates.length > 0
                ? scrollableCandidates.reduce((best, it) => (it.area! > (best.area ?? -1) ? it : best), scrollableCandidates[0])
                : null;
            const chooseCandidateIndex =
              chosen && typeof chosen.index === 'number' && Number.isFinite(chosen.index) ? chosen.index : null;

            const hasAnyScrollable = scrollableCandidates.length > 0;

            return {
              selector,
              count,
              exists: count > 0,
              hasAnyScrollable,
              chooseCandidateIndex,
              items,
            };
          } catch (err) {
            return { selector, error: String(err && err.message ? err.message : err) };
          }
        })()`,
        true,
      ),
      20000,
    );

    return { available: true, ...value };
  } catch (err: any) {
    return { available: true, selector: safeSelector, error: err?.message || String(err) };
  }
};

const evalInRenderer = async (win: BrowserWindow | null, script: string, timeoutMs: number = 1500) => {
  if (!win || win.isDestroyed()) {
    return { available: false, error: 'main_window_unavailable' };
  }

  try {
    const value = await withTimeout(win.webContents.executeJavaScript(script, true), timeoutMs);
    return { available: true, value };
  } catch (err: any) {
    return { available: true, error: err?.message || String(err) };
  }
};

export async function startHapaDebugApi(options: StartHapaDebugApiOptions): Promise<HapaDebugApiHandle> {
  const token =
    typeof options.token === 'string' && options.token.trim().length > 0
      ? options.token.trim()
      : randomBytes(32).toString('hex');

  const host = '127.0.0.1';

  const server = http.createServer(async (req, res) => {
    const remoteAddr = req.socket.remoteAddress || '';
    if (!isLocalAddress(remoteAddr)) {
      sendJson(res, 403, { ok: false, error: 'forbidden' });
      return;
    }

    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const method = (req.method || 'GET').toUpperCase();

    if (method !== 'GET') {
      sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
      return;
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      sendJson(res, 200, { ok: true, service: 'hapa-debug-api', time: new Date().toISOString() });
      return;
    }

    const providedToken = getBearerToken(req) || url.searchParams.get('token');
    if (!providedToken || providedToken !== token) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return;
    }

    const win = options.getMainWindow();

    if (url.pathname === '/v1/info') {
      sendJson(res, 200, {
        ok: true,
        pid: process.pid,
        platform: process.platform,
        versions: process.versions,
      });
      return;
    }

    if (url.pathname === '/v1/renderer/state') {
      const snapshot = await getRendererSnapshot(win);
      sendJson(res, 200, { ok: true, renderer: snapshot });
      return;
    }

    if (url.pathname === '/v1/renderer/dom') {
      const selector = url.searchParams.get('selector') || '';
      const result = await runDomQuery(win, selector);
      sendJson(res, 200, { ok: true, dom: result });
      return;
    }

    if (url.pathname === '/v1/renderer/scroll-virtual-grid') {
      const modeRaw = String(url.searchParams.get('mode') || '').trim();
      const mode = modeRaw === 'wheel' ? 'wheel' : 'scrollTop';
      const to = String(url.searchParams.get('to') || '').trim();
      const topRaw = url.searchParams.get('top');
      const deltaRaw = url.searchParams.get('delta');
      const deltaYRaw = url.searchParams.get('deltaY');

      const parseIntSafe = (raw: string | null): number | null => {
        if (typeof raw !== 'string') return null;
        const t = raw.trim();
        if (!t) return null;
        const parsed = Number.parseInt(t, 10);
        if (!Number.isFinite(parsed)) return null;
        return parsed;
      };

      const parseNumberSafe = (raw: string | null): number | null => {
        if (typeof raw !== 'string') return null;
        const t = raw.trim();
        if (!t) return null;
        const parsed = Number.parseFloat(t);
        if (!Number.isFinite(parsed)) return null;
        return parsed;
      };

      const top = parseIntSafe(topRaw);
      const delta = parseIntSafe(deltaRaw);
      const deltaY = parseNumberSafe(deltaYRaw);

      const allowedTo = ['top', 'bottom', 'start', 'end', 'near-bottom', 'near-top'];
      if (mode === 'scrollTop' && to && !allowedTo.includes(to)) {
        sendJson(res, 200, { ok: true, scrollVirtualGrid: null, error: 'to_invalid' });
        return;
      }

      if (mode === 'scrollTop' && !to && typeof top !== 'number' && typeof delta !== 'number') {
        sendJson(res, 200, { ok: true, scrollVirtualGrid: null, error: 'to_or_top_or_delta_required' });
        return;
      }
      if (mode === 'wheel' && typeof deltaY !== 'number') {
        sendJson(res, 200, { ok: true, scrollVirtualGrid: null, error: 'deltaY_required_for_wheel' });
        return;
      }

      const limitedTop = typeof top === 'number' ? Math.max(0, Math.min(top, 50_000_000)) : null;
      const limitedDelta = typeof delta === 'number' ? Math.max(-500_000, Math.min(delta, 500_000)) : null;
      const limitedDeltaY =
        typeof deltaY === 'number' ? Math.max(-500_000, Math.min(deltaY, 500_000)) : null;

      const result = await evalInRenderer(
        win,
        `(() => {
          const mode = ${JSON.stringify(mode)};
          const to = ${JSON.stringify(to)};
          const top = ${JSON.stringify(limitedTop)};
          const delta = ${JSON.stringify(limitedDelta)};
          const deltaY = ${JSON.stringify(limitedDeltaY)};
          try {
            const nodes = Array.from(document.querySelectorAll('[data-virtual-grid-scroll-container="true"]'));
            if (!nodes.length) return { ok: false, error: 'scroller_not_found', candidatesCount: 0 };

            const candidates = nodes.map((el, idx) => {
              const r = el.getBoundingClientRect();
              const scrollHeight = el.scrollHeight ?? 0;
              const clientHeight = el.clientHeight ?? 0;
              const area = r ? r.width * r.height : 0;
              const scrollable = scrollHeight > clientHeight + 2;
              return { el, idx, area, scrollHeight, clientHeight, scrollable };
            });

            const scrollableCandidates = candidates.filter((c) => c.scrollable);
            const chosen =
              scrollableCandidates.length > 0
                ? scrollableCandidates.reduce((best, c) => (c.area > best.area ? c : best), scrollableCandidates[0])
                : null;

            const scroller = chosen ? chosen.el : candidates[0].el;
            const chosenIndex = chosen ? chosen.idx : 0;
            const maxScrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
            const before = {
              scrollTop: scroller.scrollTop,
              scrollHeight: scroller.scrollHeight,
              clientHeight: scroller.clientHeight,
              maxScrollTop,
              atBottom: scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2,
            };

            if (mode === 'wheel') {
              try {
                scroller.dispatchEvent(
                  new WheelEvent('wheel', { deltaY: typeof deltaY === 'number' ? deltaY : 0, bubbles: true, cancelable: true }),
                );
              } catch (err) {
                return { ok: false, error: String(err && err.message ? err.message : err), mode };
              }
            } else {
              let next = before.scrollTop;
              if (to) {
                if (to === 'top' || to === 'start' || to === 'near-top') next = 0;
                if (to === 'bottom' || to === 'end' || to === 'near-bottom') next = maxScrollTop;
              } else if (typeof top === 'number') {
                next = top;
              } else if (typeof delta === 'number') {
                next = before.scrollTop + delta;
              }

              if (!Number.isFinite(next)) next = before.scrollTop;
              next = Math.max(0, Math.min(next, maxScrollTop));

              try {
                scroller.scrollTop = next;
              } catch {
              }
              try {
                scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
              } catch {
              }
            }

            const after = {
              scrollTop: scroller.scrollTop,
              scrollHeight: scroller.scrollHeight,
              clientHeight: scroller.clientHeight,
              maxScrollTop,
              atBottom: scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2,
            };

            return {
              ok: true,
              mode,
              requested: { to, top, delta, deltaY },
              selectedIndex: chosenIndex,
              candidatesCount: candidates.length,
              before,
              after,
            };
          } catch (err) {
            return { ok: false, error: String(err && err.message ? err.message : err) };
          }
        })()`,
        2500,
      );

      sendJson(res, 200, { ok: true, scrollVirtualGrid: result });
      return;
    }

    if (url.pathname === '/v1/renderer/navigate') {
      const raw = String(url.searchParams.get('hash') || url.searchParams.get('path') || '').trim();
      if (!raw) {
        sendJson(res, 200, { ok: true, navigate: null, error: 'hash_or_path_required' });
        return;
      }

      if (raw.length > 200) {
        sendJson(res, 200, { ok: true, navigate: null, error: 'hash_or_path_too_long' });
        return;
      }

      const nextHash = raw.startsWith('#') ? raw : raw.startsWith('/') ? `#${raw}` : `#/${raw}`;
      const result = await evalInRenderer(
        win,
        `(() => {
          const nextHash = ${JSON.stringify(nextHash)};
          try {
            const before = String(location.hash || '');
            location.hash = nextHash;
            return { ok: true, before, after: String(location.hash || ''), requested: nextHash };
          } catch (err) {
            return { ok: false, error: String(err && err.message ? err.message : err), requested: nextHash };
          }
        })()`,
        2000,
      );
      sendJson(res, 200, { ok: true, navigate: result });
      return;
    }

    if (url.pathname === '/v1/renderer/click') {
      const selector = String(url.searchParams.get('selector') || '').trim();
      const text = String(url.searchParams.get('text') || '').trim();
      const tag = String(url.searchParams.get('tag') || 'rux-button,button,a').trim();
      const indexRaw = url.searchParams.get('index');
      const index = indexRaw ? Number.parseInt(indexRaw, 10) : 0;

      if (!Number.isFinite(index) || index < 0 || index > 200) {
        sendJson(res, 200, { ok: true, click: null, error: 'index_invalid' });
        return;
      }

      if (!selector && !text) {
        sendJson(res, 200, { ok: true, click: null, error: 'selector_or_text_required' });
        return;
      }

      if (selector.length > 250 || text.length > 120 || tag.length > 120) {
        sendJson(res, 200, { ok: true, click: null, error: 'input_too_long' });
        return;
      }

      const result = await evalInRenderer(
        win,
        `(() => {
          const selector = ${JSON.stringify(selector)};
          const text = ${JSON.stringify(text)};
          const tag = ${JSON.stringify(tag)};
          const index = ${JSON.stringify(index)};
          try {
            const method = selector ? 'selector' : 'text';
            let nodes = [];
            let target = null;

            if (selector) {
              try {
                target = document.querySelector(selector);
              } catch (err) {
                return {
                  ok: false,
                  clicked: false,
                  method,
                  error: 'selector_invalid',
                  message: String(err && err.message ? err.message : err),
                  selector,
                };
              }

              try {
                nodes = Array.from(document.querySelectorAll(selector));
              } catch {
                nodes = target ? [target] : [];
              }

              if (index > 0) {
                target = nodes[index] || null;
              }
            } else {
              const needle = String(text || '').trim().toLowerCase();
              nodes = Array.from(document.querySelectorAll(tag)).filter((el) => {
                try {
                  const t = String(el && el.textContent ? el.textContent : '').trim().toLowerCase();
                  return t.includes(needle);
                } catch {
                  return false;
                }
              });
              target = nodes[index] || null;
            }

            const count = nodes.length;
            if (!target) {
              return { ok: false, clicked: false, method, error: 'not_found', count, index, selector, text, tag };
            }

            try {
              if (typeof target.scrollIntoView === 'function') {
                target.scrollIntoView({ block: 'center' });
              }
            } catch {
            }

            const matchedText = (() => {
              try {
                return String(target.textContent || '').trim();
              } catch {
                return '';
              }
            })();
            const tagName = (() => {
              try {
                return String(target.tagName || '').trim();
              } catch {
                return '';
              }
            })();
            const href = (() => {
              try {
                return typeof target.href === 'string' ? target.href : null;
              } catch {
                return null;
              }
            })();

            try {
              if (typeof target.click === 'function') {
                target.click();
              } else {
                target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
              }
            } catch (err) {
              return {
                ok: false,
                clicked: false,
                method,
                error: 'click_failed',
                message: String(err && err.message ? err.message : err),
                matchedText,
                tag: tagName,
                href,
              };
            }

            return {
              ok: true,
              clicked: true,
              method,
              matchedText,
              tag: tagName,
              href,
              count,
              index,
            };
          } catch (err) {
            return {
              ok: false,
              clicked: false,
              error: String(err && err.message ? err.message : err),
              selector,
              text,
              tag,
              index,
            };
          }
        })()`,
        2500,
      );

      sendJson(res, 200, { ok: true, click: result });
      return;
    }

    if (url.pathname === '/v1/renderer/text') {
      const selector = String(url.searchParams.get('selector') || '').trim();
      if (!selector) {
        sendJson(res, 200, { ok: true, text: null, error: 'selector_required' });
        return;
      }
      if (selector.length > 250) {
        sendJson(res, 200, { ok: true, text: null, error: 'selector_too_long' });
        return;
      }

      const result = await evalInRenderer(
        win,
        `(() => {
          const selector = ${JSON.stringify(selector)};
          try {
            const el = document.querySelector(selector);
            if (!el) return { ok: false, selector, error: 'not_found' };
            const value = String(el.textContent || '').trim();
            return { ok: true, selector, value };
          } catch (err) {
            return { ok: false, selector, error: String(err && err.message ? err.message : err) };
          }
        })()`,
        2000,
      );

      sendJson(res, 200, { ok: true, text: result });
      return;
    }

    if (url.pathname === '/v1/ipc/p2p-get-length') {
      const coreName = String(url.searchParams.get('coreName') || url.searchParams.get('name') || '').trim();
      if (!coreName) {
        sendJson(res, 200, { ok: true, result: null, error: 'coreName_required' });
        return;
      }

      if (coreName.length > 200) {
        sendJson(res, 200, { ok: true, result: null, error: 'coreName_too_long' });
        return;
      }

      const result = await evalInRenderer(
        win,
        `(async () => {
          const api = (window).electronAPI;
          if (!api || typeof api.p2pGetLength !== 'function') return { ok: false, error: 'electron_api_unavailable' };
          try {
            const length = await api.p2pGetLength(${JSON.stringify(coreName)});
            return { ok: true, coreName: ${JSON.stringify(coreName)}, length };
          } catch (err) {
            return { ok: false, coreName: ${JSON.stringify(coreName)}, error: String(err && err.message ? err.message : err) };
          }
        })()`,
        2500,
      );
      sendJson(res, 200, { ok: true, p2pGetLength: result });
      return;
    }

    if (url.pathname === '/v1/ipc/persistence-stats') {
      const result = await evalInRenderer(
        win,
        `(async () => {
          const api = (window).electronAPI;
          if (!api || typeof api.getPersistenceStats !== 'function') return { ok: false, error: 'electron_api_unavailable' };
          try {
            const stats = await api.getPersistenceStats();
            return { ok: true, stats };
          } catch (err) {
            return { ok: false, error: String(err && err.message ? err.message : err) };
          }
        })()`,
        2500,
      );
      sendJson(res, 200, { ok: true, persistenceStats: result });
      return;
    }

    if (url.pathname === '/v1/ipc/system-stats') {
      const result = await evalInRenderer(
        win,
        `(async () => {
          const api = (window).electronAPI;
          if (!api || typeof api.getSystemStats !== 'function') return { ok: false, error: 'electron_api_unavailable' };
          try {
            const stats = await api.getSystemStats();
            return { ok: true, stats };
          } catch (err) {
            return { ok: false, error: String(err && err.message ? err.message : err) };
          }
        })()`,
        10000,
      );
      sendJson(res, 200, { ok: true, systemStats: result });
      return;
    }

    if (url.pathname === '/v1/ipc/diagnostics-snapshot') {
      const result = await evalInRenderer(
        win,
        `(async () => {
          const api = (window).electronAPI;
          if (!api || typeof api.getDiagnosticsSnapshot !== 'function') return { ok: false, error: 'electron_api_unavailable' };
          try {
            const snapshot = await api.getDiagnosticsSnapshot();
            return { ok: true, snapshot };
          } catch (err) {
            return { ok: false, error: String(err && err.message ? err.message : err) };
          }
        })()`,
        10000,
      );
      sendJson(res, 200, { ok: true, diagnosticsSnapshot: result });
      return;
    }

    if (url.pathname === '/v1/ipc/persistence-rebuild-card-library-index') {
      const result = await evalInRenderer(
        win,
        `(async () => {
          const api = (window).electronAPI;
          if (!api || typeof api.persistenceRebuildCardLibraryIndex !== 'function') return { ok: false, error: 'electron_api_unavailable' };
          try {
            const res = await api.persistenceRebuildCardLibraryIndex();
            return { ok: true, res };
          } catch (err) {
            return { ok: false, error: String(err && err.message ? err.message : err) };
          }
        })()`,
        60000,
      );
      sendJson(res, 200, { ok: true, persistenceRebuildCardLibraryIndex: result });
      return;
    }

    if (url.pathname === '/v1/ipc/nexus-index-page') {
      const coreName = String(url.searchParams.get('coreName') || 'card-library').trim();
      if (!coreName) {
        sendJson(res, 200, { ok: true, result: null, error: 'coreName_required' });
        return;
      }
      if (coreName.length > 200) {
        sendJson(res, 200, { ok: true, result: null, error: 'coreName_too_long' });
        return;
      }

      const cursorRaw = url.searchParams.get('cursor');
      const limitRaw = url.searchParams.get('limit');
      const direction = String(url.searchParams.get('direction') || 'reverse').trim() || 'reverse';

      let cursor: number | undefined = undefined;
      if (typeof cursorRaw === 'string' && cursorRaw.trim().length > 0) {
        const parsed = Number.parseInt(cursorRaw, 10);
        if (!Number.isFinite(parsed) || parsed < 0) {
          sendJson(res, 200, { ok: true, result: null, error: 'cursor_invalid' });
          return;
        }
        cursor = parsed;
      } else if (direction !== 'reverse') {
        cursor = 0;
      }

      const limitParsed = typeof limitRaw === 'string' && limitRaw.trim().length > 0 ? Number.parseInt(limitRaw, 10) : null;
      const limit =
        typeof limitParsed === 'number' && Number.isFinite(limitParsed) && limitParsed > 0
          ? Math.min(limitParsed, 5000)
          : undefined;

      const payload: any = {
        coreName,
        direction,
      };
      if (typeof cursor === 'number') payload.cursor = cursor;
      if (typeof limit === 'number') payload.limit = limit;

      const result = await evalInRenderer(
        win,
        `(async () => {
          const api = (window).electronAPI;
          if (!api || typeof api.nexusIndexPage !== 'function') return { ok: false, error: 'electron_api_unavailable' };
          const payload = ${JSON.stringify(payload)};
          try {
            const res = await api.nexusIndexPage(payload);
            return { ok: true, payload, res };
          } catch (err) {
            return { ok: false, payload, error: String(err && err.message ? err.message : err) };
          }
        })()`,
        4000,
      );
      sendJson(res, 200, { ok: true, nexusIndexPage: result });
      return;
    }

    if (url.pathname === '/v1/checks/cards-loaded') {
      const minRaw = url.searchParams.get('min');
      const min = minRaw ? Number.parseInt(minRaw, 10) : 120;
      const snapshot = await getRendererSnapshot(win);
      const count =
        snapshot &&
        snapshot.debugState &&
        snapshot.debugState.cardLibrary &&
        typeof snapshot.debugState.cardLibrary.cardsCount === 'number'
          ? snapshot.debugState.cardLibrary.cardsCount
          : null;

      if (typeof count !== 'number') {
        sendJson(res, 200, { ok: true, result: null, error: 'card_library_state_unavailable', renderer: snapshot });
        return;
      }

      sendJson(res, 200, { ok: true, min, count, result: count > min });
      return;
    }

    if (url.pathname === '/v1/checks/operator-panel-ready') {
      const requireSnapshotRaw = url.searchParams.get('requireSnapshot');
      const requireSnapshot = requireSnapshotRaw === '1' || requireSnapshotRaw === 'true';
      const snapshot = await getRendererSnapshot(win);
      const panel = snapshot && (snapshot as any).debugState && (snapshot as any).debugState.operatorRealityPanel
        ? (snapshot as any).debugState.operatorRealityPanel
        : null;

      const active = !!(panel && panel.active);
      const hasSnapshot = !!(panel && panel.snapshot);
      const ok = requireSnapshot ? (active && hasSnapshot) : active;

      sendJson(res, 200, {
        ok: true,
        requireSnapshot,
        active,
        hasSnapshot,
        result: ok,
        operatorRealityPanel: panel,
      });
      return;
    }

    sendJson(res, 404, { ok: false, error: 'not_found' });
  });

  const requestedPort =
    typeof options.port === 'number' && Number.isFinite(options.port) && options.port > 0 ? options.port : 0;

  const listenOn = (port: number) =>
    new Promise<void>((resolve, reject) => {
      const onError = (err: any) => {
        server.removeListener('listening', onListening);
        reject(err);
      };

      const onListening = () => {
        server.removeListener('error', onError);
        resolve();
      };

      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, host);
    });

  try {
    await listenOn(requestedPort);
  } catch (err: any) {
    if (err?.code === 'EADDRINUSE' && requestedPort !== 0) {
      await listenOn(0);
    } else {
      throw err;
    }
  }

  const address = server.address();
  const port = typeof address === 'object' && address && typeof address.port === 'number' ? address.port : requestedPort;
  const baseUrl = `http://${host}:${port}`;

  return {
    port,
    token,
    baseUrl,
    close: () =>
      new Promise<void>((resolve) => {
        try {
          server.close(() => resolve());
        } catch {
          resolve();
        }
      }),
  };
}
