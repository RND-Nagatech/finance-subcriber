# Errors

## [ERR-20260828-001] zsh-parser-range-check

**Logged**: 2026-08-28T12:20:00+07:00
**Priority**: low
**Status**: resolved
**Area**: tooling

### Summary
Fallback parser-range inspection failed because the command used Bash array syntax and GNU-style `sed` assumptions under macOS zsh/sed.

### Error
```text
zsh:read:1: bad option: -a
sed: illegal option -- 2
```

### Context
- Attempted to inspect parser-flagged source ranges after codebase-memory coverage reported partial files.
- Environment: macOS zsh and BSD sed.

### Suggested Fix
Use direct `sed -n 'N,Mp'` calls or portable shell loops without `read -a`; avoid assuming GNU sed flags.

### Metadata
- Reproducible: yes
- Related Files: new-fe/src/pages/Transaksi.tsx, new-fe/src/pages/Dashboard.tsx, new-fe/src/pages/DashboardV2.tsx, new-fe/src/pages/PerjalananDinasWorkspace.tsx, new-fe/src/pages/SubscriberVpsDashboard.tsx

---

## [ERR-20260828-002] endpoint-auth-shell-quoting

**Logged**: 2026-08-28T12:25:00+07:00
**Priority**: low
**Status**: resolved
**Area**: tooling

### Summary
Multi-endpoint curl command was rejected by the tool JavaScript wrapper due to nested quoting.

### Error
```text
Script error: SyntaxError: Unexpected string
```

### Context
- Read-only production API verification with a temporary shell token variable.

### Suggested Fix
Use a simpler command string or a separate explicit curl invocation per endpoint.

### Metadata
- Reproducible: unknown
- Related Files: none

---
