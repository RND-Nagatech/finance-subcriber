# Nagatech Agent API Integration Standard v1

> Panduan implementasi API seragam untuk aplikasi **Finance**, **Order**, **Subscription**, dan aplikasi internal lain yang akan dihubungkan ke Company AI Agent.
>
> Dokumen ini ditujukan untuk diberikan langsung kepada coding agent/developer yang mengerjakan masing-masing aplikasi.

---

# 1. Tujuan

Aplikasi Finance, Order, Subscription, dan aplikasi internal lain saat ini sudah berjalan sebagai aplikasi mandiri.

Kita **tidak ingin mengganti atau merombak aplikasi yang sudah berjalan**.

Kita hanya ingin menambahkan jalur komunikasi API yang:

- konsisten antar aplikasi;
- aman;
- mudah dipanggil oleh Agent Gateway;
- mudah didokumentasikan;
- mudah diuji;
- mudah dimonitor;
- tidak bergantung pada tampilan website;
- tidak membocorkan detail database;
- siap digunakan untuk AI tool/function calling;
- scalable ketika jumlah API menjadi ratusan atau ribuan.

Arsitektur target:

```text
                    Gemini Live
                        |
                        v
                 Agent Gateway
                    (NestJS)
                        |
                Tool / API Router
                        |
       +----------------+----------------+
       |                |                |
       v                v                v
    Finance          Orders        Subscription
      API              API              API
       |                |                |
       v                v                v
 Existing App     Existing App     Existing App
```

Agent tidak boleh mengakses database masing-masing aplikasi secara langsung.

**Source of truth tetap aplikasi pemilik data.**

---

# 2. Prinsip Utama

Semua implementasi wajib mengikuti prinsip berikut.

## 2.1 Jangan merusak aplikasi existing

API Agent harus dibuat secara additive.

Jangan:

- mengganti route existing tanpa kebutuhan;
- mengubah response API existing secara breaking;
- mengubah business logic lama jika tidak diperlukan;
- mengganti struktur database hanya untuk kebutuhan Agent;
- membuat Agent langsung query database jika business logic sebenarnya sudah tersedia di aplikasi.

Jika aplikasi sudah mempunyai service/function internal untuk mengambil data, gunakan kembali service tersebut.

---

## 2.2 Agent API adalah adapter

Contoh:

```text
Existing Finance Service
        |
        +--> Finance Website
        |
        +--> Agent API
```

Agent API harus menjadi adapter menuju business logic existing.

Bukan membuat business logic finance baru di layer Agent.

---

## 2.3 API adalah source of truth

AI tidak boleh menebak data operasional.

Contoh pertanyaan:

```text
"Berapa omzet bulan ini?"
```

Harus menghasilkan:

```text
Agent
  |
  v
Finance API
  |
  v
Actual Database / Business Logic
  |
  v
Structured Result
```

Bukan menjawab dari memory LLM.

---

# 3. Namespace API

Untuk menghindari bentrok dengan API existing, seluruh API khusus Agent direkomendasikan menggunakan prefix:

```text
/api/agent/v1
```

Contoh Finance:

```text
GET /api/agent/v1/finance/summary
GET /api/agent/v1/finance/revenue
GET /api/agent/v1/finance/receivables
```

Order:

```text
GET /api/agent/v1/orders/summary
GET /api/agent/v1/orders
GET /api/agent/v1/orders/:orderId
```

Subscription:

```text
GET /api/agent/v1/subscriptions/summary
GET /api/agent/v1/subscriptions
GET /api/agent/v1/subscriptions/expiring
```

Gunakan versioning dari awal.

```text
v1
v2
...
```

Jangan membuat:

```text
/api/agent/finance
```

tanpa versi.

---

# 4. REST Convention

Gunakan HTTP method sesuai fungsi.

| Operation | Method |
|---|---|
| mengambil data | GET |
| membuat data | POST |
| memperbarui sebagian data | PATCH |
| mengganti resource penuh | PUT |
| menghapus data | DELETE |

Untuk MVP Company Agent, prioritaskan API **READ ONLY**.

Contoh:

```text
GET /api/agent/v1/finance/summary
```

Bukan:

```text
POST /api/agent/v1/get-finance-summary
```

---

# 5. Naming Convention

Gunakan:

```text
lowercase
kebab-case
plural noun untuk collection
```

Contoh benar:

```text
/orders
/subscriptions
/payment-status
/account-receivables
```

Hindari:

```text
/getOrders
/get_order
/OrderList
/getDataFinance
```

---

# 6. Standard Response

Semua Agent API WAJIB menggunakan envelope response yang konsisten.

## Success

```json
{
  "success": true,
  "data": {},
  "metadata": {
    "source": "finance",
    "generatedAt": "2026-09-09T10:30:00.000Z",
    "requestId": "req_01JXYZ"
  }
}
```

Field wajib:

```text
success
data
metadata.source
metadata.generatedAt
metadata.requestId
```

---

# 7. Response Collection

Untuk data collection:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "orderId": "ORD-001",
        "customerName": "PT ABC",
        "total": 12500000,
        "status": "pending"
      }
    ]
  },
  "metadata": {
    "source": "orders",
    "generatedAt": "2026-09-09T10:30:00.000Z",
    "requestId": "req_01JXYZ",
    "pagination": {
      "page": 1,
      "limit": 50,
      "totalItems": 241,
      "totalPages": 5
    }
  }
}
```

Jangan mengembalikan array langsung:

```json
[
  {},
  {}
]
```

---

# 8. Standard Error Response

Semua error harus terstruktur.

```json
{
  "success": false,
  "error": {
    "code": "FINANCE_INVALID_PERIOD",
    "message": "Periode laporan tidak valid",
    "details": null
  },
  "metadata": {
    "source": "finance",
    "generatedAt": "2026-09-09T10:30:00.000Z",
    "requestId": "req_01JXYZ"
  }
}
```

Jangan return stack trace kepada Agent Gateway.

Contoh error code:

```text
AUTH_INVALID_TOKEN
AUTH_FORBIDDEN

VALIDATION_ERROR

FINANCE_INVALID_PERIOD
FINANCE_DATA_NOT_FOUND
FINANCE_SERVICE_UNAVAILABLE

ORDER_NOT_FOUND
ORDER_INVALID_STATUS

SUBSCRIPTION_NOT_FOUND
SUBSCRIPTION_INVALID_STATUS

INTERNAL_ERROR
```

---

# 9. HTTP Status Code

Gunakan dengan konsisten.

| Status | Keterangan |
|---|---|
| 200 | Success |
| 201 | Created |
| 400 | Invalid request |
| 401 | Authentication gagal |
| 403 | Tidak mempunyai permission |
| 404 | Resource tidak ditemukan |
| 409 | Conflict |
| 422 | Validation/business rule error |
| 429 | Rate limit |
| 500 | Internal server error |
| 503 | Dependency/service unavailable |

Jangan selalu return HTTP 200 ketika terjadi error.

---

# 10. Authentication

Agent Gateway harus menggunakan **service-to-service authentication**.

Minimum rekomendasi:

```text
Authorization: Bearer <SERVICE_TOKEN>
```

Lebih baik jika token mempunyai:

```text
service identity
scope
expiration
```

Contoh claim:

```json
{
  "sub": "nagatech-agent-gateway",
  "aud": "finance-api",
  "scope": [
    "agent:finance:read"
  ],
  "exp": 1788944400
}
```

Jangan menggunakan credential user website untuk Agent Gateway.

Jangan simpan token di frontend.

Semua komunikasi:

```text
Agent Gateway -> Internal API
```

harus dilakukan dari backend.

---

# 11. Permission

Permission harus granular.

Contoh:

```text
agent:finance:read
agent:finance:write

agent:orders:read
agent:orders:write

agent:subscriptions:read
agent:subscriptions:write
```

MVP direkomendasikan:

```text
READ ONLY
```

---

# 12. Read vs Write

Bedakan operation menjadi:

```text
READ
WRITE
DESTRUCTIVE
```

Contoh:

```text
getFinanceSummary
=> READ

createOrder
=> WRITE

cancelOrder
=> DESTRUCTIVE
```

Metadata endpoint/tool harus menyimpan risk level.

Contoh:

```json
{
  "risk": "read"
}
```

atau:

```json
{
  "risk": "write"
}
```

atau:

```json
{
  "risk": "destructive"
}
```

Untuk WRITE dan DESTRUCTIVE, Agent Gateway nantinya wajib melakukan confirmation flow.

---

# 13. Filtering

Semua endpoint list harus mendukung filter yang masuk akal.

Contoh:

```http
GET /api/agent/v1/orders?status=pending&startDate=2026-09-01&endDate=2026-09-09
```

Jangan membuat endpoint terpisah jika sebenarnya hanya filter.

Kurang baik:

```text
/orders/pending
/orders/completed
/orders/cancelled
```

Lebih baik:

```text
/orders?status=pending
/orders?status=completed
/orders?status=cancelled
```

Endpoint khusus boleh dibuat jika merupakan agregasi/business use case penting.

Contoh:

```text
/orders/summary
/subscriptions/expiring
/finance/profit-loss
```

---

# 14. Pagination

Endpoint yang berpotensi menghasilkan banyak records WAJIB menggunakan pagination.

Default:

```text
page=1
limit=50
```

Maximum direkomendasikan:

```text
limit=100
```

Contoh:

```http
GET /api/agent/v1/orders?page=1&limit=50
```

Jangan biarkan Agent mengambil:

```text
100.000 rows
```

dalam satu response.

---

# 15. Sorting

Gunakan format konsisten:

```text
sortBy
sortOrder
```

Contoh:

```http
GET /api/agent/v1/orders?sortBy=createdAt&sortOrder=desc
```

Value:

```text
asc
desc
```

---

# 16. Search

Gunakan parameter:

```text
search
```

Contoh:

```http
GET /api/agent/v1/orders?search=PT%20ABC
```

Search dapat mencari field yang relevan seperti:

```text
customerName
orderNumber
invoiceNumber
phone
```

Dokumentasikan field mana yang searchable.

---

# 17. Date dan Time

Semua timestamp API menggunakan:

```text
ISO 8601
UTC
```

Contoh:

```text
2026-09-09T10:30:00.000Z
```

Untuk filter tanggal:

```text
startDate
endDate
```

Contoh:

```http
?startDate=2026-09-01&endDate=2026-09-30
```

Jika business menggunakan timezone tertentu, dokumentasikan.

Untuk Nagatech, jika business report menggunakan WIB:

```text
Asia/Jakarta
UTC+07:00
```

Tetapi response timestamp sistem tetap disarankan UTC.

---

# 18. Currency

Jangan mengirim angka uang sebagai string berformat manusia.

Salah:

```json
{
  "revenue": "Rp 1.250.000.000"
}
```

Benar:

```json
{
  "revenue": 1250000000,
  "currency": "IDR"
}
```

Formatting dilakukan oleh Agent/UI.

---

# 19. Number

Gunakan JSON number.

Benar:

```json
{
  "quantity": 125,
  "amount": 1500000,
  "percentage": 12.5
}
```

Hindari:

```json
{
  "quantity": "125",
  "amount": "1500000"
}
```

kecuali identifier memang berupa string.

---

# 20. Boolean

Gunakan:

```json
true
false
```

Bukan:

```text
"Y"
"N"
"YES"
"NO"
1
0
```

pada Agent API.

Jika database existing menggunakan format tersebut, adapter Agent API harus menormalisasinya.

---

# 21. Enum

Status harus mempunyai value stabil.

Contoh Order:

```text
pending
processing
completed
cancelled
```

Subscription:

```text
active
expired
cancelled
suspended
```

Payment:

```text
unpaid
partial
paid
overdue
```

Dokumentasikan seluruh enum.

Jangan mengubah value enum tanpa versioning.

---

# 22. ID

Setiap resource harus mempunyai identifier stabil.

Contoh:

```json
{
  "orderId": "ORD-001"
}
```

Jika database menggunakan MongoDB ObjectId, jangan memaksa Agent menggunakan `_id` apabila terdapat business identifier yang lebih baik.

Contoh:

```text
orderId
invoiceNumber
customerCode
subscriptionId
```

---

# 23. Aggregate Endpoint

AI lebih sering membutuhkan **summary** daripada raw rows.

Karena itu setiap domain harus menyediakan endpoint aggregate.

Contoh Finance:

```text
GET /api/agent/v1/finance/summary
GET /api/agent/v1/finance/revenue
GET /api/agent/v1/finance/expenses
GET /api/agent/v1/finance/profit-loss
GET /api/agent/v1/finance/receivables/summary
```

Order:

```text
GET /api/agent/v1/orders/summary
GET /api/agent/v1/orders/status-summary
```

Subscription:

```text
GET /api/agent/v1/subscriptions/summary
GET /api/agent/v1/subscriptions/revenue-summary
GET /api/agent/v1/subscriptions/expiring
```

Lebih baik API menghitung agregasi menggunakan database/business service daripada mengirim ribuan rows ke AI.

Prinsip:

```text
COMPUTE FIRST
LLM SECOND
```

---

# 24. Jangan Kirim Data Berlebihan

Agent API harus mendukung:

```text
fields
```

jika diperlukan.

Contoh:

```http
GET /api/agent/v1/orders?fields=orderId,customerName,total,status
```

Namun jangan membuat implementasi terlalu kompleks jika belum dibutuhkan.

Yang terpenting: response default harus sudah ringkas.

---

# 25. Sensitive Data

Jangan secara default mengembalikan:

```text
password
password hash
access token
refresh token
API key
secret key
private key
session
internal credential
full payment credential
```

PII seperti:

```text
phone
email
address
identity number
```

hanya dikembalikan jika memang diperlukan dan caller mempunyai permission.

---

# 26. Request ID

Setiap request harus mempunyai:

```text
requestId
```

Agent Gateway dapat mengirim:

```http
X-Request-Id: req_01JXYZ
```

Jika tidak tersedia, aplikasi boleh generate sendiri.

Request ID harus muncul di:

```text
response
application log
error log
audit log
```

Tujuan:

```text
Voice conversation
      |
Agent Gateway log
      |
requestId
      |
Finance API log
```

dapat dilacak end-to-end.

---

# 27. Correlation ID

Jika satu user request menghasilkan beberapa API call, gunakan:

```http
X-Correlation-Id
```

Contoh:

```text
conversation request
    |
    +--> finance
    +--> orders
    +--> subscriptions
```

Semua request dapat mempunyai:

```text
X-Correlation-Id: corr_abc123
```

---

# 28. Logging

Log minimum:

```text
timestamp
requestId
correlationId
method
path
statusCode
durationMs
serviceCaller
userContext jika tersedia
```

Contoh:

```json
{
  "timestamp": "2026-09-09T10:30:00.000Z",
  "requestId": "req_01JXYZ",
  "correlationId": "corr_ABC",
  "method": "GET",
  "path": "/api/agent/v1/finance/summary",
  "statusCode": 200,
  "durationMs": 82,
  "caller": "nagatech-agent-gateway"
}
```

Jangan log:

```text
password
token
secret
full authorization header
```

---

# 29. Performance

Target awal rekomendasi untuk endpoint read sederhana:

```text
P95 < 1 second
```

Endpoint aggregate berat:

```text
P95 < 3 seconds
```

Jika query membutuhkan proses sangat berat, evaluasi:

```text
database index
pre-aggregation
cache
materialized report
background calculation
```

Jangan menjadikan LLM sebagai solusi atas query database yang lambat.

---

# 30. Timeout

Setiap API harus mempunyai timeout yang jelas.

Agent Gateway sebaiknya tidak menunggu API tanpa batas.

Rekomendasi awal:

```text
simple API: 5 seconds
aggregate API: 10 seconds
```

Jika dependency timeout:

```json
{
  "success": false,
  "error": {
    "code": "FINANCE_SERVICE_TIMEOUT",
    "message": "Finance service tidak memberikan response tepat waktu"
  }
}
```

---

# 31. Idempotency

Untuk operasi WRITE seperti:

```text
create
payment
cancel
renew
```

dukung:

```http
Idempotency-Key
```

Contoh:

```http
Idempotency-Key: 79ca8ab0-...
```

Request yang sama tidak boleh menghasilkan operasi ganda.

READ endpoint tidak memerlukan idempotency key.

---

# 32. OpenAPI Wajib

Setiap aplikasi WAJIB menghasilkan dokumentasi:

```text
OpenAPI 3.x
```

Direkomendasikan tersedia di:

```text
/api/agent/docs
```

dan raw JSON:

```text
/api/agent/openapi.json
```

Dokumentasi harus memuat:

```text
endpoint
method
description
authentication
permission
query params
path params
request body
response schema
error schema
example
enum
```

Tool Registry pusat nantinya dapat dibangun dari dokumentasi tersebut.

---

# 33. Endpoint Health

Setiap aplikasi sediakan:

```text
GET /api/agent/v1/health
```

Response:

```json
{
  "success": true,
  "data": {
    "service": "finance",
    "status": "healthy",
    "version": "1.0.0"
  },
  "metadata": {
    "source": "finance",
    "generatedAt": "2026-09-09T10:30:00.000Z",
    "requestId": "req_health_001"
  }
}
```

Jangan expose detail sensitif database pada endpoint health publik/internal biasa.

---

# 34. Capability Endpoint

Sangat direkomendasikan menyediakan:

```text
GET /api/agent/v1/capabilities
```

Tujuannya agar Agent Gateway mengetahui kemampuan service.

Contoh Finance:

```json
{
  "success": true,
  "data": {
    "service": "finance",
    "version": "1.0.0",
    "capabilities": [
      {
        "id": "finance.summary",
        "description": "Mengambil ringkasan keuangan",
        "risk": "read"
      },
      {
        "id": "finance.revenue",
        "description": "Mengambil data omzet/revenue",
        "risk": "read"
      },
      {
        "id": "finance.receivables",
        "description": "Mengambil data piutang customer",
        "risk": "read"
      }
    ]
  },
  "metadata": {
    "source": "finance",
    "generatedAt": "2026-09-09T10:30:00.000Z",
    "requestId": "req_cap_001"
  }
}
```

---

# 35. Agent Tool Metadata

Selain OpenAPI, setiap endpoint Agent harus mempunyai metadata konsep/tool.

Contoh:

```yaml
tool:
  id: finance.receivables.summary
  domain: finance
  capability: receivables
  risk: read

  description: >
    Mengambil ringkasan piutang customer pada periode tertentu.

  use_when:
    - user menanyakan piutang
    - user menanyakan outstanding customer
    - user menanyakan pembayaran customer yang belum lunas

  do_not_use_when:
    - user menanyakan hutang ke supplier

  permission:
    - agent:finance:read
```

Metadata ini akan sangat membantu Tool Router.

---

# 36. Jangan Expose Semua Endpoint ke Gemini

Aplikasi masing-masing boleh mempunyai banyak endpoint.

Contoh:

```text
Finance = 80 endpoint
Orders = 120 endpoint
Subscription = 60 endpoint
```

Semua endpoint tersebut akan masuk ke **central internal Tool Registry**.

Tetapi Gemini Live nantinya hanya melihat high-level domain tools.

Contoh:

```text
query_finance
query_orders
query_subscriptions
```

Pemilihan API detail dilakukan oleh Agent Gateway + Tool Router.

---

# 37. Granularity Endpoint

Jangan terlalu generic:

```text
POST /api/agent/v1/query
{
  "query": "..."
}
```

API aplikasi harus tetap deterministic.

Juga jangan terlalu granular jika tidak perlu.

Kurang baik:

```text
/get-total-revenue-today
/get-total-revenue-yesterday
/get-total-revenue-this-month
```

Lebih baik:

```text
GET /finance/revenue?startDate=...&endDate=...
```

---

# 38. Finance API Minimum

Agent Finance sebaiknya minimal mempunyai capability berikut.

## Summary

```text
GET /api/agent/v1/finance/summary
```

Filter:

```text
startDate
endDate
branchId optional
```

Response data contoh:

```json
{
  "revenue": 4850000000,
  "expenses": 3200000000,
  "grossProfit": 1650000000,
  "currency": "IDR"
}
```

---

## Revenue

```text
GET /api/agent/v1/finance/revenue
```

---

## Expenses

```text
GET /api/agent/v1/finance/expenses
```

---

## Profit & Loss

```text
GET /api/agent/v1/finance/profit-loss
```

---

## Receivables Summary

```text
GET /api/agent/v1/finance/receivables/summary
```

Contoh:

```json
{
  "totalOutstanding": 1200000000,
  "overdue": 420000000,
  "customerCount": 72,
  "currency": "IDR"
}
```

---

## Receivables List

```text
GET /api/agent/v1/finance/receivables
```

Filter:

```text
status
customerId
startDate
endDate
page
limit
```

---

## Cashflow

```text
GET /api/agent/v1/finance/cashflow
```

---

# 39. Orders API Minimum

## Summary

```text
GET /api/agent/v1/orders/summary
```

Contoh:

```json
{
  "totalOrders": 325,
  "totalValue": 1280000000,
  "pending": 28,
  "processing": 91,
  "completed": 200,
  "cancelled": 6,
  "currency": "IDR"
}
```

---

## List Orders

```text
GET /api/agent/v1/orders
```

Filter:

```text
status
customerId
startDate
endDate
search
page
limit
sortBy
sortOrder
```

---

## Order Detail

```text
GET /api/agent/v1/orders/:orderId
```

---

## Status Summary

```text
GET /api/agent/v1/orders/status-summary
```

---

# 40. Subscription API Minimum

## Summary

```text
GET /api/agent/v1/subscriptions/summary
```

Contoh:

```json
{
  "active": 750,
  "expired": 45,
  "cancelled": 18,
  "monthlyRecurringRevenue": 425000000,
  "currency": "IDR"
}
```

---

## Subscription List

```text
GET /api/agent/v1/subscriptions
```

Filter:

```text
status
customerId
planId
startDate
endDate
page
limit
```

---

## Subscription Detail

```text
GET /api/agent/v1/subscriptions/:subscriptionId
```

---

## Expiring Subscription

```text
GET /api/agent/v1/subscriptions/expiring?days=7
```

---

## Subscription Revenue

```text
GET /api/agent/v1/subscriptions/revenue-summary
```

---

# 41. Cross-System Identifier

Finance, Order, dan Subscription harus sebisa mungkin mempunyai identifier yang dapat dikorelasikan.

Contoh:

```text
customerId
orderId
invoiceId
subscriptionId
```

Contoh:

Finance:

```json
{
  "customerId": "CUS-000123"
}
```

Orders:

```json
{
  "customerId": "CUS-000123"
}
```

Subscription:

```json
{
  "customerId": "CUS-000123"
}
```

Ini sangat penting agar Agent dapat menjawab pertanyaan cross-system seperti:

```text
"Customer yang masih punya piutang apakah mempunyai order aktif?"
```

---

# 42. Data Consistency

Jika terdapat identifier berbeda antar aplikasi, jangan meminta AI menebak mapping.

Buat mapping deterministic.

Contoh:

```text
Finance customer ID
        |
        v
Customer Master Service
        |
        v
Global customerId
```

Idealnya organisasi mempunyai:

```text
Global Customer ID
Global Branch ID
Global Employee ID
```

---

# 43. Validation

Semua input harus divalidasi.

Contoh:

```text
startDate valid
endDate valid
startDate <= endDate
status termasuk enum
limit <= maximum
ID format valid
```

Jangan mengandalkan LLM untuk selalu mengirim input valid.

---

# 44. Schema Validation

Jika Node.js/TypeScript, gunakan salah satu:

```text
Zod
class-validator
Joi
```

Contoh konsep:

```typescript
const QuerySchema = z.object({
  startDate: z.string().date(),
  endDate: z.string().date(),
  status: z.enum(["paid", "unpaid", "overdue"]).optional()
});
```

---

# 45. SQL / NoSQL Injection

Parameter dari Agent tetap dianggap **untrusted input**.

Jangan pernah:

```javascript
eval(agentInput)
```

Jangan membangun raw query secara langsung dari natural language.

Salah:

```text
AI mengirim MongoDB query mentah
```

Benar:

```text
AI
 |
structured parameters
 |
validation
 |
service
 |
database query
```

---

# 46. AI Tidak Boleh Mengirim Raw Database Query

Agent Gateway tidak boleh mempunyai generic endpoint seperti:

```text
POST /execute-mongo-query
POST /execute-sql
```

untuk production.

Gunakan API capability yang jelas.

---

# 47. Rate Limiting

Walaupun internal, pasang rate limiting reasonable.

Contoh:

```text
100 requests/minute/service
```

Atur sesuai load masing-masing aplikasi.

Tujuannya mencegah loop Agent menghasilkan traffic tidak terkendali.

---

# 48. Retry

GET request dapat di-retry oleh Agent Gateway jika failure bersifat transient.

Write request tidak boleh blindly retry kecuali menggunakan idempotency.

Service harus membedakan:

```text
validation error
business error
temporary dependency error
```

---

# 49. Caching

Cache boleh digunakan untuk data yang tidak memerlukan realtime sempurna.

Contoh:

```text
subscription plan
branch list
static configuration
```

Untuk:

```text
current balance
payment status
current order status
```

gunakan TTL sangat pendek atau no-cache sesuai kebutuhan.

Metadata boleh menambahkan:

```json
{
  "cache": {
    "hit": true,
    "ageSeconds": 10
  }
}
```

jika berguna.

---

# 50. Freshness

Endpoint summary direkomendasikan menambahkan:

```text
dataAsOf
```

Contoh:

```json
{
  "success": true,
  "data": {
    "revenue": 1250000000,
    "dataAsOf": "2026-09-09T10:29:58.000Z"
  }
}
```

Agent dapat menjawab:

```text
"Data terakhir diperbarui pukul ..."
```

jika diperlukan.

---

# 51. Testing

Setiap endpoint wajib mempunyai minimal:

```text
unit test
integration test
authentication test
validation test
error test
```

Endpoint kritikal juga harus mempunyai:

```text
permission test
pagination test
large dataset test
```

---

# 52. Contract Test

Karena Agent Gateway bergantung pada schema API, buat contract test.

Contract test memastikan field seperti:

```text
success
data
metadata
```

tidak berubah tanpa sengaja.

OpenAPI schema harus masuk CI jika memungkinkan.

---

# 53. Backward Compatibility

Jika endpoint V1 sudah dipakai Agent Gateway:

Jangan:

```text
rename field
hapus field
ubah datatype
ubah enum
ubah arti field
```

secara langsung.

Jika breaking change diperlukan:

```text
/api/agent/v2
```

atau rollout backward-compatible.

---

# 54. Deprecation

Jika endpoint akan dihentikan, dokumentasikan:

```text
deprecated: true
replacement
sunset date
```

Jangan tiba-tiba menghapus endpoint.

---

# 55. Observability

Minimal sediakan metrics:

```text
request count
error count
latency
status code
endpoint
```

Ideal:

```text
Prometheus
Grafana
OpenTelemetry
```

Tetapi existing monitoring stack boleh digunakan.

---

# 56. Audit

Untuk endpoint READ sensitif dan semua WRITE, simpan audit jika diperlukan.

Contoh:

```json
{
  "actor": "nagatech-agent-gateway",
  "userId": "USER-001",
  "operation": "finance.receivables.read",
  "resource": "CUS-001",
  "requestId": "req_...",
  "timestamp": "..."
}
```

---

# 57. Documentation per Endpoint

Setiap endpoint wajib menjawab:

```text
1. Endpoint ini digunakan untuk apa?
2. Kapan Agent sebaiknya menggunakannya?
3. Kapan Agent tidak boleh menggunakannya?
4. Parameter apa saja?
5. Mana parameter required?
6. Response seperti apa?
7. Error apa saja?
8. Permission apa?
9. Data freshness?
10. Apakah READ / WRITE / DESTRUCTIVE?
```

---

# 58. Machine-Readable Tool Manifest

Direkomendasikan setiap aplikasi mempunyai file:

```text
agent-tools.yaml
```

Contoh:

```yaml
service:
  id: finance
  name: Nagatech Finance
  version: 1.0.0

tools:

  - id: finance.summary

    method: GET
    path: /api/agent/v1/finance/summary

    capability: summary

    risk: read

    description: >
      Mengambil ringkasan kondisi keuangan perusahaan
      pada periode tertentu.

    use_when:
      - user menanyakan kondisi keuangan
      - user menanyakan ringkasan finance
      - user meminta omzet, expense dan profit secara umum

    parameters:

      startDate:
        type: string
        format: date
        required: true

      endDate:
        type: string
        format: date
        required: true

      branchId:
        type: string
        required: false

    permission:
      - agent:finance:read
```

File ini nantinya dapat di-ingest ke central Tool Registry.

---

# 59. Folder Recommendation

Jangan wajib mengikuti struktur ini jika framework existing berbeda.

Namun secara konsep pisahkan:

```text
agent/
├── controllers
├── services
├── dto
├── schemas
├── guards
├── middleware
├── docs
└── tests
```

Contoh NestJS:

```text
src/
└── agent-api/
    ├── agent-api.module.ts
    ├── finance/
    ├── orders/
    ├── subscriptions/
    ├── common/
    └── docs/
```

Gunakan existing service aplikasi sebagai dependency.

---

# 60. Instruksi untuk Coding Agent

Saat menerima dokumen ini, coding agent WAJIB melakukan workflow berikut.

## STEP 1 — Audit Existing Application

Pelajari terlebih dahulu:

```text
existing routes
existing controllers
existing services
existing database models
authentication
authorization
logging
error handling
business rules
```

Jangan langsung menulis API.

---

## STEP 2 — Identifikasi Reusable Business Logic

Cari function/service yang sudah menghasilkan data yang dibutuhkan.

Contoh:

```text
FinanceReportService
OrderService
SubscriptionService
```

Reuse.

Jangan duplicate calculation.

---

## STEP 3 — Buat Agent API Terisolasi

Tambahkan namespace:

```text
/api/agent/v1
```

tanpa mengganggu API/UI existing.

---

## STEP 4 — Implement Read-Only First

Prioritas:

```text
summary
list
detail
aggregate
search/filter
```

Jangan implement write sebelum read API stabil kecuali diminta secara eksplisit.

---

## STEP 5 — Tambahkan Standard Envelope

Semua response mengikuti standar dokumen ini.

---

## STEP 6 — Tambahkan Service Authentication

Pastikan API tidak terbuka tanpa credential internal.

---

## STEP 7 — Tambahkan Validation

Seluruh parameter divalidasi.

---

## STEP 8 — Tambahkan OpenAPI

Dokumentasi harus dapat dibaca developer dan machine.

---

## STEP 9 — Buat agent-tools.yaml

Daftarkan capability yang tersedia.

---

## STEP 10 — Tambahkan Test

Pastikan existing application tetap lulus test.

---

## STEP 11 — Jangan Breaking Change

Jalankan regression test terhadap route existing.

---

## STEP 12 — Laporkan Hasil

Coding agent harus membuat laporan:

```text
API yang dibuat
file yang berubah
existing service yang digunakan
permission
OpenAPI path
tool manifest
test result
known limitation
```

---

# 61. Output yang Diharapkan dari Coding Agent

Setelah implementasi selesai, coding agent harus memberikan minimal:

```text
1. Daftar endpoint Agent API
2. OpenAPI documentation
3. agent-tools.yaml
4. Authentication configuration
5. Environment variable yang diperlukan
6. Unit/integration test
7. Contoh curl
8. Catatan breaking change (harusnya NONE)
```

---

# 62. Contoh CURL

Finance:

```bash
curl \
  -H "Authorization: Bearer $AGENT_SERVICE_TOKEN" \
  "https://finance.example.com/api/agent/v1/finance/summary?startDate=2026-09-01&endDate=2026-09-09"
```

Order:

```bash
curl \
  -H "Authorization: Bearer $AGENT_SERVICE_TOKEN" \
  "https://order.example.com/api/agent/v1/orders?status=pending&page=1&limit=50"
```

Subscription:

```bash
curl \
  -H "Authorization: Bearer $AGENT_SERVICE_TOKEN" \
  "https://subscription.example.com/api/agent/v1/subscriptions/expiring?days=7"
```

---

# 63. Environment Variable

Rekomendasi:

```env
AGENT_API_ENABLED=true

AGENT_SERVICE_AUDIENCE=finance-api

AGENT_TOKEN_PUBLIC_KEY=...

AGENT_API_RATE_LIMIT=100

AGENT_API_LOG_LEVEL=info
```

Jangan commit:

```text
private key
token
password
secret
```

ke repository.

---

# 64. Checklist Sebelum Merge

## Compatibility

- [ ] Program existing tetap berjalan.
- [ ] Tidak ada breaking change.
- [ ] Route existing tidak berubah.
- [ ] Existing business logic digunakan kembali jika memungkinkan.

## API

- [ ] Prefix `/api/agent/v1`.
- [ ] REST naming konsisten.
- [ ] Response envelope konsisten.
- [ ] Error response konsisten.
- [ ] Pagination tersedia untuk collection.
- [ ] Filter terdokumentasi.
- [ ] Date ISO 8601.
- [ ] Currency numeric + currency code.
- [ ] Enum terdokumentasi.

## Security

- [ ] Service authentication aktif.
- [ ] Permission tersedia.
- [ ] Input validation aktif.
- [ ] Sensitive field tidak bocor.
- [ ] Token tidak masuk log.
- [ ] Raw DB query tidak dapat dieksekusi Agent.

## Observability

- [ ] Request ID.
- [ ] Correlation ID.
- [ ] Structured log.
- [ ] Error logging.
- [ ] Latency tercatat.

## Documentation

- [ ] OpenAPI tersedia.
- [ ] Contoh request.
- [ ] Contoh response.
- [ ] Error code.
- [ ] `agent-tools.yaml`.
- [ ] Capability endpoint.

## Testing

- [ ] Unit test.
- [ ] Integration test.
- [ ] Authentication test.
- [ ] Validation test.
- [ ] Regression test.

---

# 65. Definition of Done

Sebuah aplikasi dianggap **Agent Ready** jika:

```text
1. Existing program tidak terganggu.

2. Agent Gateway dapat authenticate.

3. Agent Gateway dapat mengambil data menggunakan API terstruktur.

4. Tidak ada direct database access dari Agent.

5. Response menggunakan schema standar.

6. Semua endpoint terdokumentasi melalui OpenAPI.

7. Capability tersedia melalui agent-tools.yaml.

8. Error dapat dipahami secara machine-readable.

9. Request dapat dilacak menggunakan requestId/correlationId.

10. API mempunyai test.

11. Read operation sudah stabil.

12. Data operasional tetap berasal dari source application.
```

---

# 66. Prinsip Akhir

Selalu gunakan pola:

```text
User
 |
 v
Gemini Live
 |
 v
Agent Gateway
 |
 v
Tool Router
 |
 v
Domain API
 |
 v
Existing Business Logic
 |
 v
Database
```

Bukan:

```text
LLM
 |
 v
Database langsung
```

Dan bukan:

```text
LLM
 |
 v
Browser automation
 |
 v
Website
```

jika aplikasi menyediakan API.

Tujuan akhir standardisasi ini adalah membuat semua aplikasi Nagatech dapat dihubungkan seperti plugin:

```text
Agent Gateway

    |
    +-- Finance
    |
    +-- Orders
    |
    +-- Subscription
    |
    +-- Inventory
    |
    +-- Projects
    |
    +-- HR
    |
    +-- aplikasi berikutnya...
```

tanpa perlu mengubah arsitektur Agent setiap kali aplikasi baru ditambahkan.

---

# 67. Catatan untuk Agent Developer

Jika terdapat perbedaan antara dokumen ini dengan arsitektur aplikasi existing:

1. Pertahankan kompatibilitas existing terlebih dahulu.
2. Implementasikan adapter di Agent API.
3. Jangan melakukan refactor besar hanya agar sesuai dokumen.
4. Laporkan gap yang ditemukan.
5. Usulkan perubahan terpisah jika diperlukan.
6. Jangan mengubah business rule tanpa persetujuan.
7. Jangan menebak arti field database yang tidak jelas.
8. Gunakan source code existing sebagai acuan business behavior.
9. Dokumentasikan asumsi.
10. Prioritaskan keamanan dan backward compatibility.

---

**Document:** Nagatech Agent API Integration Standard  
**Version:** 1.0  
**Status:** Draft Standard for Finance / Orders / Subscription Agent Integration
