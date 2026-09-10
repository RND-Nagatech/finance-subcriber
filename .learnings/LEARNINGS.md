## [LRN-20260910-001] correction

**Logged**: 2026-09-10T00:00:00+07:00
**Priority**: high
**Status**: pending
**Area**: docs

### Summary
Project `finance-subcriber` hanya menjadi sumber endpoint Finance untuk integrasi Agent.

### Details
Subscription sudah dipisahkan ke project lain. Planning Agent API untuk repository ini tidak boleh memasukkan endpoint Subscription, VPS, Subscriber, atau Order Confirmation sebagai capability utama.

### Suggested Action
Batasi scope Agent API pada finance summary, revenue, expenses, profit and loss, receivables, cashflow, transaksi, rekening, saldo, budget, fiscal, dan asset bila relevan dengan kebutuhan Finance.

### Metadata
- Source: user_feedback
- Related Files: docs/nagatech-agent-api-integration-standard-v1.md
- Tags: agent-api, finance-only, scope

---
## [LRN-20260910-002] correction

**Logged**: 2026-09-10T00:00:00+07:00
**Priority**: high
**Status**: pending
**Area**: docs

### Summary
Perjalanan Dinas dan Asset termasuk scope Finance Agent API project ini.

### Details
Scope Finance-only bukan hanya transaksi, rekening, budget, dan fiscal. Modul Perjalanan Dinas serta Asset/Asset Ledger juga harus dapat disediakan sebagai capability read-only Agent jika relevan.

### Suggested Action
Masukkan endpoint summary, list, detail, saldo, ledger, dan status audit yang relevan untuk Perjalanan Dinas serta Asset ke planning dan manifest, tanpa memasukkan Subscription, VPS, Subscriber, atau Order Confirmation.

### Metadata
- Source: user_feedback
- Related Files: docs/nagatech-agent-api-integration-standard-v1.md
- Tags: agent-api, finance-only, perjalanan-dinas, asset

---

## [LRN-20260910-003] operational correction

**Logged**: 2026-09-10T00:00:00+07:00
**Priority**: medium
**Status**: pending
**Area**: tooling

### Summary
Smoke-test commands must use the repository workdir exactly once.

### Details
An HTTP smoke test was initially launched with a duplicated backend path, so the process could not start. The failure was operational and unrelated to the implementation.

### Suggested Action
Validate the workdir against the current repository path before running follow-up commands.

---
