import { v4 as uuidv4 } from 'uuid';

export async function seedIfEmpty({ core, appendEvent }) {
  if (core.length > 0) return;

  const ts = Date.now();

  await appendEvent({
    id: uuidv4(),
    ts,
    type: 'status_definitions.set',
    actor: 'seed',
    data: {
      statuses: [
        { key: 'BACKLOG', name: 'Backlog', order_index: 0, color: '#64748b' },
        { key: 'READY', name: 'Ready', order_index: 1, color: '#0ea5e9' },
        { key: 'IN_PROGRESS', name: 'In Progress', order_index: 2, color: '#a855f7' },
        { key: 'BLOCKED', name: 'Blocked', order_index: 3, color: '#ef4444' },
        { key: 'REVIEW', name: 'Review', order_index: 4, color: '#f59e0b' },
        { key: 'DONE', name: 'Done', order_index: 5, color: '#10b981', is_terminal: true },
        { key: 'ARCHIVED', name: 'Archived', order_index: 6, color: '#475569', is_terminal: true }
      ]
    }
  });

  const makeTask = ({ title, description, status_key, kind }) => {
    const now = Date.now();
    return {
      task_id: uuidv4(),
      kind: kind || 'task',
      title,
      description: description || '',
      status_key: status_key || 'BACKLOG',
      created_at: now,
      updated_at: now,
      created_by: 'seed',
      updated_by: 'seed'
    };
  };

  const t1 = makeTask({
    title: 'Open Tasks Node: Implement backend (Hypercore + SQLite + cache)',
    description: 'Backend prototype: loopback server, open read, token-gated writes, Hypercore event log, SQLite projection, markdown preview allowlist.',
    status_key: 'IN_PROGRESS'
  });

  const t2 = makeTask({
    title: 'Open Tasks Node: Implement UI (Kanban, graph, task detail, refs, agents, status editor)',
    description: 'UI should support multiple views and allow editing status definitions.',
    status_key: 'BACKLOG'
  });

  const t3 = makeTask({
    title: 'Open Tasks Node: Implement CLI + smoke tests (self-test JSON report)',
    description: 'CLI should auto-discover runtime + token; smoke test should exercise create/move/refs/status edits.',
    status_key: 'BACKLOG'
  });

  const t4 = makeTask({
    title: 'Create prioritized next-steps backlog + Overwatch perspective',
    description: 'After prototype works end-to-end, create prioritized backlog and record check-in note.',
    status_key: 'BACKLOG'
  });

  const t5 = makeTask({
    title: 'Overwatch Update Request: Add Open Tasks Node to STATUS_BOARD + PORTS_AND_AUTH',
    description: 'Once the node runs locally, add it to Overwatch ecosystem docs and record validation.',
    status_key: 'READY',
    kind: 'overwatch_request'
  });

  for (const task of [t1, t2, t3, t4, t5]) {
    await appendEvent({
      id: uuidv4(),
      ts: Date.now(),
      type: 'task.created',
      actor: 'seed',
      data: { task }
    });
  }

  await appendEvent({
    id: uuidv4(),
    ts: Date.now(),
    type: 'task.ref.added',
    actor: 'seed',
    data: {
      ref: {
        ref_id: uuidv4(),
        task_id: t1.task_id,
        kind: 'markdown',
        path: '/Users/calderwong/Desktop/.Overwatch/CHECK_IN_2026-01-03_OPEN_TASKS_NODE_PROTO.md',
        label: 'Open Tasks Node prototype check-in',
        created_at: Date.now(),
        created_by: 'seed'
      }
    }
  });
}
