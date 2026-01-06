import { v4 as uuidv4 } from 'uuid';

function trimBaseUrl(v) {
  return String(v || '')
    .trim()
    .replace(/\/+$/g, '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, { timeoutMs = 60000, ...opts } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ac.signal });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: res.status, json, text };
  } finally {
    clearTimeout(t);
  }
}

export function createAvatarClient({ mode, baseUrl, token }) {
  const modeNorm = String(mode || 'remote').trim().toLowerCase();

  if (modeNorm === 'stub') {
    return createStubClient();
  }

  if (modeNorm === 'disabled' || modeNorm === 'none' || modeNorm === 'off') {
    return createUnconfiguredClient('Avatar mode disabled');
  }

  const base = trimBaseUrl(baseUrl);
  if (!base) {
    return createUnconfiguredClient('Missing avatar base URL');
  }

  const authHeader = token ? { authorization: `Bearer ${String(token).trim()}` } : {};

  return {
    async expandAvatar(body, { timeoutMs } = {}) {
      const res = await fetchJson(`${base}/v1/expand/avatar`, {
        timeoutMs: timeoutMs ?? 3600_000,
        method: 'POST',
        headers: {
          ...authHeader,
          'content-type': 'application/json'
        },
        body: JSON.stringify(body || {})
      });

      if (res.status !== 200) {
        const detail = res.json?.detail || res.json?.error || res.text;
        throw new Error(`Avatar expand failed (${res.status}): ${String(detail).slice(0, 600)}`);
      }

      return res.json;
    },

    async status(jobId, { timeoutMs } = {}) {
      const jid = String(jobId || '').trim();
      if (!jid) throw new Error('Missing job_id');

      const res = await fetchJson(`${base}/v1/status/${encodeURIComponent(jid)}`, {
        timeoutMs: timeoutMs ?? 60_000,
        method: 'GET',
        headers: {
          ...authHeader
        }
      });

      if (res.status !== 200) {
        const detail = res.json?.detail || res.json?.error || res.text;
        throw new Error(`Avatar status failed (${res.status}): ${String(detail).slice(0, 600)}`);
      }

      return res.json;
    },

    async preview(avatarName, { timeoutMs } = {}) {
      const name = String(avatarName || '').trim();
      if (!name) throw new Error('Missing avatar_name');

      const res = await fetchJson(`${base}/v1/preview/${encodeURIComponent(name)}`, {
        timeoutMs: timeoutMs ?? 60_000,
        method: 'GET',
        headers: {
          ...authHeader
        }
      });

      if (res.status !== 200) {
        const detail = res.json?.detail || res.json?.error || res.text;
        throw new Error(`Avatar preview failed (${res.status}): ${String(detail).slice(0, 600)}`);
      }

      return res.json;
    },

    async exportAvatar(avatarName, { timeoutMs } = {}) {
      const name = String(avatarName || '').trim();
      if (!name) throw new Error('Missing avatar_name');

      const res = await fetchJson(`${base}/v1/export/${encodeURIComponent(name)}`, {
        timeoutMs: timeoutMs ?? 60_000,
        method: 'POST',
        headers: {
          ...authHeader
        }
      });

      if (res.status !== 200) {
        const detail = res.json?.detail || res.json?.error || res.text;
        throw new Error(`Avatar export failed (${res.status}): ${String(detail).slice(0, 600)}`);
      }

      return res.json;
    }
  };
}

function createUnconfiguredClient(reason) {
  const message = String(reason || 'Avatar client not configured');

  const fail = async () => {
    throw new Error(message);
  };

  return {
    expandAvatar: fail,
    status: fail,
    preview: fail,
    exportAvatar: fail
  };
}

function createStubClient() {
  const jobs = new Map();

  return {
    async expandAvatar(body) {
      const avatarName = String(body?.avatar_name || '').trim();
      if (!avatarName) {
        return { ok: false, status: 'failed', error: 'Missing avatar_name' };
      }

      const asyncMode = body?.async_mode !== undefined ? !!body.async_mode : true;

      if (!asyncMode) {
        return {
          ok: true,
          status: 'succeeded',
          result: {
            avatar_name: avatarName,
            stub: true,
            created_at: new Date().toISOString()
          }
        };
      }

      const jobId = uuidv4().replace(/-/g, '');
      const result = {
        avatar_name: avatarName,
        stub: true,
        job_id: jobId,
        created_at: new Date().toISOString()
      };

      jobs.set(jobId, { ok: true, job_id: jobId, status: 'running' });

      await sleep(10);
      jobs.set(jobId, { ok: true, job_id: jobId, status: 'succeeded', result });

      return { ok: true, job_id: jobId, status: 'running' };
    },

    async status(jobId) {
      const jid = String(jobId || '').trim();
      const job = jobs.get(jid);
      if (!job) {
        return { ok: false, job_id: jid, status: 'failed', error: 'Unknown job_id' };
      }
      return job;
    },

    async preview(avatarName) {
      const name = String(avatarName || '').trim();
      if (!name) return { ok: false, error: 'Missing avatar_name' };
      return { ok: true, avatar_name: name, stub: true };
    },

    async exportAvatar(avatarName) {
      const name = String(avatarName || '').trim();
      if (!name) return { ok: false, error: 'Missing avatar_name' };
      return { ok: true, avatar_name: name, stub: true };
    }
  };
}
