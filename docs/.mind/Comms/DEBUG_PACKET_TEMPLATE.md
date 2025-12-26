# Debug Packet Template (copy/paste)

## Summary

- Issue:
- Area: (Card Library / Persistence / P2P / Pipeline / UI)
- Severity: (Crash / Data loss / Wrong truth / Perf)
- First noticed:

## Repro

- Steps:
  1.
  2.
  3.
- Expected:
- Actual:

## Environment

- App build:
- OS:
- Storage override (`HAPA_STORAGE_DIR`):
- Debug API enabled (`HAPA_DEBUG_API`):

## Diagnostics Snapshot

Paste output from the diagnostics snapshot endpoint:

- Source:
  - Operator Reality Panel: “Copy JSON”
  - or Debug API: `/v1/ipc/diagnostics-snapshot`

```json
{
  "paste": "here"
}
```

## Persistence Stats

Paste output:

- Operator Reality Panel (SQLite section)
- or Debug API: `/v1/ipc/persistence-stats`

```json
{
  "paste": "here"
}
```

## System Stats

Paste output:

- Operator Reality Panel (Storage/Network section)
- or Debug API: `/v1/ipc/system-stats`

```json
{
  "paste": "here"
}
```

## Card Library Paging Snapshot

Paste output:

- Operator Reality Panel (Paging Snapshot section)
- or Debug API: `/v1/ipc/nexus-index-page?coreName=card-library&direction=reverse&limit=1`

```json
{
  "paste": "here"
}
```

## UI Debug State (optional but helpful)

Paste `window.__HAPA_DEBUG_STATE__.cardLibrary`:

- Operator Reality Panel (UI Debug section)
- or Debug API: `/v1/renderer/state`

```json
{
  "paste": "here"
}
```

## Logs

- Electron main process logs (last ~200 lines):
- Renderer console logs (last ~200 lines):
- Any `error.log` excerpts:

```text
paste logs here
```

## Screenshots / screen recording

- Card Library top of scroll:
- Card Library bottom of scroll:
- Any error dialogs:

## Notes

- Anything that makes the issue more/less likely:
- Any recent actions right before the issue (Recover, Rebuild Index, imports, etc.):
