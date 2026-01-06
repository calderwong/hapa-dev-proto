import { getMeta, setMeta } from './db.js';

const META_LAST_APPLIED_SEQ = 'last_applied_seq';

export function getLastAppliedSeq(db) {
  const raw = getMeta(db, META_LAST_APPLIED_SEQ);
  if (raw === null || raw === undefined) return -1;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : -1;
}

export function applyEvent(db, state, { seq, event }) {
  const insertEvent = db.prepare(
    'INSERT INTO events(seq, event_id, ts, type, actor, data_json) VALUES(?, ?, ?, ?, ?, ?)'
  );

  insertEvent.run(seq, event.id, event.ts, event.type, event.actor || null, JSON.stringify(event.data ?? {}));

  if (event.type === 'agent.created') {
    applyAgentCreated(db, state, event);
  } else if (event.type === 'agent.updated') {
    applyAgentUpdated(db, state, event);
  } else if (event.type === 'agent.avatar.job_started') {
    applyAgentAvatarJobStarted(db, state, event);
  } else if (event.type === 'agent.avatar.completed') {
    applyAgentAvatarCompleted(db, state, event);
  } else if (event.type === 'agent.avatar.failed') {
    applyAgentAvatarFailed(db, state, event);
  }

  setMeta(db, META_LAST_APPLIED_SEQ, seq);
}

export async function catchUpFromLog(core, db, state) {
  const lastApplied = getLastAppliedSeq(db);
  for (let seq = lastApplied + 1; seq < core.length; seq++) {
    const event = await core.get(seq);
    db.transaction(() => {
      applyEvent(db, state, { seq, event });
    })();
  }
}

export function loadStateFromDb(db, state) {
  const rows = db
    .prepare(
      'SELECT agent_id, name, created_at, updated_at, created_by, updated_by, avatar_name, avatar_status, avatar_job_id, avatar_base_url, avatar_error, avatar_result_json FROM agents'
    )
    .all();

  const agents = rows.map((r) => ({
    ...r,
    avatar_result_json: safeParseJson(r.avatar_result_json)
  }));

  state.agentsById = new Map(agents.map((a) => [a.agent_id, a]));
}

function safeParseJson(txt) {
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function updateAgent(db, state, agentId, patch) {
  const prev = state.agentsById.get(agentId);
  if (!prev) return null;

  const next = {
    ...prev,
    ...patch,
    agent_id: agentId
  };

  db.prepare(
    `UPDATE agents
     SET name = ?, updated_at = ?, updated_by = ?,
         avatar_name = ?, avatar_status = ?, avatar_job_id = ?, avatar_base_url = ?, avatar_error = ?, avatar_result_json = ?
     WHERE agent_id = ?`
  ).run(
    next.name,
    next.updated_at,
    next.updated_by || null,
    next.avatar_name || null,
    next.avatar_status || null,
    next.avatar_job_id || null,
    next.avatar_base_url || null,
    next.avatar_error || null,
    next.avatar_result_json ? JSON.stringify(next.avatar_result_json) : null,
    agentId
  );

  state.agentsById.set(agentId, next);
  return next;
}

function applyAgentCreated(db, state, event) {
  const agent = event.data?.agent;
  if (!agent) return;

  db.prepare(
    `INSERT INTO agents(
      agent_id, name, created_at, updated_at, created_by, updated_by,
      avatar_name, avatar_status, avatar_job_id, avatar_base_url, avatar_error, avatar_result_json
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    agent.agent_id,
    agent.name,
    agent.created_at,
    agent.updated_at,
    agent.created_by || null,
    agent.updated_by || null,
    agent.avatar_name || null,
    agent.avatar_status || null,
    agent.avatar_job_id || null,
    agent.avatar_base_url || null,
    agent.avatar_error || null,
    agent.avatar_result_json ? JSON.stringify(agent.avatar_result_json) : null
  );

  state.agentsById.set(agent.agent_id, { ...agent });
}

function applyAgentUpdated(db, state, event) {
  const agentId = event.data?.agent_id;
  const patch = event.data?.patch;
  if (!agentId || !patch) return;
  updateAgent(db, state, agentId, patch);
}

function applyAgentAvatarJobStarted(db, state, event) {
  const agentId = event.data?.agent_id;
  const job = event.data?.job;
  if (!agentId || !job) return;

  updateAgent(db, state, agentId, {
    updated_at: event.ts,
    updated_by: event.actor || null,
    avatar_name: job.avatar_name || null,
    avatar_status: 'running',
    avatar_job_id: job.job_id || null,
    avatar_base_url: job.avatar_base_url || null,
    avatar_error: null,
    avatar_result_json: null
  });
}

function applyAgentAvatarCompleted(db, state, event) {
  const agentId = event.data?.agent_id;
  const result = event.data?.result;
  if (!agentId) return;

  updateAgent(db, state, agentId, {
    updated_at: event.ts,
    updated_by: event.actor || null,
    avatar_status: 'succeeded',
    avatar_error: null,
    avatar_result_json: result ?? null
  });
}

function applyAgentAvatarFailed(db, state, event) {
  const agentId = event.data?.agent_id;
  const error = event.data?.error;
  if (!agentId) return;

  updateAgent(db, state, agentId, {
    updated_at: event.ts,
    updated_by: event.actor || null,
    avatar_status: 'failed',
    avatar_error: typeof error === 'string' ? error : String(error || 'Unknown error')
  });
}
