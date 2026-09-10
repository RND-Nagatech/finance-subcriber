## [ERR-20260910-001] relative-scope-audit-path

**Logged**: 2026-09-10T00:00:00+07:00
**Priority**: low
**Status**: resolved
**Area**: tooling

### Summary
Scope audit used a `new-be/...` relative path while already running inside `new-be`.

### Error
`rg: new-be/src/agent-api: No such file or directory`

### Context
The Subscriber smoke test itself passed; only the follow-up grep path was incorrect.

### Suggested Fix
Use repository-root workdir for repository-relative audits, or omit the `new-be/` prefix inside the backend workdir.

### Metadata
- Reproducible: yes
- Related Files: new-be/src/agent-api

### Resolution
- **Resolved**: 2026-09-10T00:00:00+07:00
- **Notes**: Re-run from repository root with the correct path.
- **Recurrence-Count**: 2 (the final smoke command repeated the same relative-path mistake before the corrected audit).

---
## [ERR-20260910-002] codebase-memory-tool-unavailable

**Logged**: 2026-09-10T00:00:00+07:00
**Priority**: medium
**Status**: pending
**Area**: tooling

### Summary
Reindex could not be executed after the repository folder rename because the codebase-memory MCP tools were not callable in the session.

### Error
The `codebase_memory_mcp` tools were not present in the callable tool list, so `index_repository` could not be invoked.

### Context
New repository path: `/Volumes/nagatechExternal/2026/Work/ai/new_finance_system/subscriber`.
The existing `.codebase-memory/artifact.json` still identifies the old project name `finance-subcriber`.

### Suggested Fix
Reload or reconnect the codebase-memory MCP server, then run `index_repository` against the new repository path.

### Metadata
- Reproducible: yes
- Related Files: .codebase-memory/artifact.json

---
