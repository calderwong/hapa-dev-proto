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

  insertEvent.run(
    seq,
    event.id,
    event.ts,
    event.type,
    event.actor || null,
    JSON.stringify(event.data ?? {})
  );

  if (event.type === 'status_definitions.set') {
    applyStatusDefinitionsSet(db, state, event);
  } else if (event.type === 'task.created') {
    applyTaskCreated(db, state, event);
  } else if (event.type === 'task.updated') {
    applyTaskUpdated(db, state, event);
  } else if (event.type === 'task.ref.added') {
    applyTaskRefAdded(db, state, event);
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

function applyStatusDefinitionsSet(db, state, event) {
  const statuses = Array.isArray(event.data?.statuses) ? event.data.statuses : [];

  db.prepare('DELETE FROM status_definitions').run();
  const insert = db.prepare(
    'INSERT INTO status_definitions(status_key, name, order_index, color, is_terminal) VALUES(?, ?, ?, ?, ?)'
  );

  for (const s of statuses) {
    const statusKey = s.status_key ?? s.key;
    if (!statusKey) continue;
    insert.run(statusKey, s.name, s.order_index, s.color || null, s.is_terminal ? 1 : 0);
  }

  state.statusDefinitions = statuses.map((s) => ({
    status_key: s.status_key ?? s.key,
    name: s.name,
    order_index: s.order_index,
    color: s.color || null,
    is_terminal: !!s.is_terminal
  }));
}

function applyTaskCreated(db, state, event) {
  const task = event.data?.task;
  if (!task) return;

  db.prepare(
    'INSERT INTO tasks(task_id, kind, title, description, status_key, created_at, updated_at, created_by, updated_by) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    task.task_id,
    task.kind,
    task.title,
    task.description,
    task.status_key,
    task.created_at,
    task.updated_at,
    task.created_by || null,
    task.updated_by || null
  );

  state.tasksById.set(task.task_id, { ...task });
}

function applyTaskUpdated(db, state, event) {
  const taskId = event.data?.task_id;
  const patch = event.data?.patch;
  if (!taskId || !patch) return;

  const prev = state.tasksById.get(taskId);
  if (!prev) return;

  const next = {
    ...prev,
    ...patch,
    task_id: taskId
  };

  db.prepare(
    `UPDATE tasks
     SET kind = ?, title = ?, description = ?, status_key = ?, updated_at = ?, updated_by = ?
     WHERE task_id = ?`
  ).run(
    next.kind,
    next.title,
    next.description,
    next.status_key,
    next.updated_at,
    next.updated_by || null,
    taskId
  );

  state.tasksById.set(taskId, next);
}

function applyTaskRefAdded(db, state, event) {
  const ref = event.data?.ref;
  if (!ref) return;

  db.prepare(
    'INSERT INTO task_refs(ref_id, task_id, kind, path, label, created_at, created_by) VALUES(?, ?, ?, ?, ?, ?, ?)'
  ).run(ref.ref_id, ref.task_id, ref.kind, ref.path, ref.label || null, ref.created_at, ref.created_by || null);

  const list = state.refsByTaskId.get(ref.task_id) || [];
  list.push({ ...ref });
  state.refsByTaskId.set(ref.task_id, list);
}

export function loadStateFromDb(db, state) {
  const statuses = db
    .prepare('SELECT status_key, name, order_index, color, is_terminal FROM status_definitions ORDER BY order_index ASC')
    .all();

  state.statusDefinitions = statuses.map((s) => ({ ...s, is_terminal: !!s.is_terminal }));

  const tasks = db.prepare('SELECT * FROM tasks').all();
  state.tasksById = new Map(tasks.map((t) => [t.task_id, t]));

  const refs = db.prepare('SELECT * FROM task_refs').all();
  state.refsByTaskId = new Map();
  for (const r of refs) {
    const list = state.refsByTaskId.get(r.task_id) || [];
    list.push(r);
    state.refsByTaskId.set(r.task_id, list);
  }
}
