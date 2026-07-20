# Integration Errors

## [ERR-20260720-001] doku_checkout_optional_payload

**Logged**: 2026-07-20T13:00:00+07:00
**Priority**: medium
**Status**: resolved
**Area**: backend

### Summary
DOKU Checkout returned a generic internal server error for a request containing optional order and customer fields.

### Error
```
INTERNAL SERVER ERROR
```

### Context
- The signature, sandbox credentials, and endpoint were valid.
- A request matching DOKU's basic payload succeeded with the same credentials.
- The previous implementation discarded `error_messages` and the DOKU request ID.

### Suggested Fix
Start Checkout integration with only `order.amount`, `order.invoice_number`, and `payment.payment_due_date`. Add optional fields only after validating their documented character and conditional requirements. Preserve HTTP status, request ID, and `error_messages` in diagnostics.

### Metadata
- Reproducible: yes
- Related Files: akunting-backend/src/services/dokuService.ts

---

## [ERR-20260720-002] duplicate_workspace_path

**Logged**: 2026-07-20T13:10:00+07:00
**Priority**: low
**Status**: resolved
**Area**: config

### Summary
A verification command used a repository-relative path after changing the working directory to the backend folder.

### Error
```
nl: akunting-backend/src/models/TTVpsDetail.ts: No such file or directory
```

### Context
- The command ran from `akunting-backend`, so the file path was duplicated.
- The backend build in the same command still completed successfully.

### Suggested Fix
Use paths relative to the selected command working directory.

### Metadata
- Reproducible: yes
- Related Files: akunting-backend/src/models/TTVpsDetail.ts

---
