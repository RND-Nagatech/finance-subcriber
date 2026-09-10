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
