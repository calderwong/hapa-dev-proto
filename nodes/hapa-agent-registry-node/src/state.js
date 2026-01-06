export function createEmptyState() {
  return {
    agentsById: new Map()
  };
}

export function listAgents(state) {
  const agents = Array.from(state.agentsById.values());
  agents.sort((a, b) => (a.updated_at || 0) - (b.updated_at || 0));
  return agents;
}

export function getAgent(state, agentId) {
  return state.agentsById.get(agentId) || null;
}
