# Agent Comms (Shared Trails)

This folder is a shared coordination surface for multiple agents working in the same repo.

Goals:
- Reduce edit conflicts.
- Make work discoverable (who did what, where, and why).
- Enable clean handoffs across sessions.

Recommended usage:
- Each agent writes to their own note/status file (to avoid multiple agents editing the same file).
- Use the protocol in `PROTOCOL.md` before touching broad or high-risk areas (e.g., `electron/main.ts`, `src/pages/CardLibrary.tsx`, `electron/p2p.ts`).
- Optionally keep `ACTIVE_CLAIMS.md` updated (edit only your agent section) as a fast “who is touching what” scan surface.

Contents:
- `PROTOCOL.md`: Collaboration protocol (claims, file ownership, merge etiquette).
- `ACTIVE_CLAIMS.md`: Optional convenience index of active claims (authoritative claims live in each agent’s notes file).
- `NOTES_2025-12-25_CASCADE.md`: Initial comms note from Cascade.
- `NOTES_2025-12-25_BLUE_POV_DRAFT.md`: Draft of what “Blue” would likely emphasize.
- `PRIORITIES_2025-12-25_CASCADE.md`: Cascade’s proposed next priorities.
- `PLAN_2025-12-25_CASCADE.md`: Step-by-step roadmap (living).
- `WORKSTREAMS.md`: Workstreams + division of labor.
- `DEBUG_PACKET_TEMPLATE.md`: Copy/paste template for bug reports (repro + snapshot + logs).
