export function createEmptyState() {
  return {
    statusDefinitions: [],
    tasksById: new Map(),
    refsByTaskId: new Map()
  };
}

export function getTask(state, taskId) {
  const task = state.tasksById.get(taskId);
  if (!task) return null;

  const refs = state.refsByTaskId.get(taskId) || [];
  return { ...task, refs };
}

export function listTasks(state, { status, kind } = {}) {
  let tasks = Array.from(state.tasksById.values());

  if (status) tasks = tasks.filter((t) => t.status_key === status);
  if (kind) tasks = tasks.filter((t) => t.kind === kind);

  tasks.sort((a, b) => (a.updated_at || 0) - (b.updated_at || 0));
  return tasks;
}

export function listStatusDefinitions(state) {
  return [...state.statusDefinitions].sort((a, b) => a.order_index - b.order_index);
}
