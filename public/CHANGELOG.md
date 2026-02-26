# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-02-26

### Added
- **Perjalanan Dinas Module (Backend + Frontend)**: New end-to-end workflow for business trip fund management and auditing
  - New backend routes under `/api/perjalanan-dinas`
  - New frontend pages/routes for:
    - `Perjalanan Dinas`
    - `Transaksi Perjalanan`
    - `Dana Perjalanan`
    - `Audit Perjalanan`
  - New sidebar navigation group with `Perjalanan Dinas` parent menu + submenus

- **Dedicated Perjalanan Dinas Data Models**
  - `tt_perjalanan_dinas` for trip header/workflow
  - `tt_perjalanan_dinas_detail` for isolated trip transaction items
  - `tt_perjalanan_dinas_dana` for inject/return fund ledger

- **Trip Fund Injection / Return Flow**
  - Multi-inject dana support from selected rekening
  - Final return sisa dana support after audit completion
  - Rekening saldo mutation integration for inject/return actions
  - Trip dana ledger listing and summary in dedicated UI

- **Trip Audit and Posting Flow**
  - Header workflow status: `BERJALAN -> SEDANG_DIAUDIT -> SELESAI`
  - Item audit status endpoint + notes support
  - Finalize audit endpoint + UI actions
  - Manual one-time posting to `tt_finance` with posting metadata lock
  - Reusable finance aggregation service for posting trip summary into `tt_finance` / `tt_finance_daily`

- **Perjalanan Dinas Attachments**
  - Upload attachment (image/pdf) to trip items
  - Delete attachment support
  - Attachment preview in audit table via in-page dialog (image/PDF)
  - Multi-attachment preview switching inside dialog
  - Dana ledger (`INJECT` / `RETURN`) attachment upload/delete support
  - Inject dana attachments auto-synced to linked transaksi draft (`tt_finance_detail`)

- **Perjalanan Dinas UI/UX Enhancements**
  - Dialog-based `Buat Header Perjalanan` form
  - Dialog-based `Tambah Transaksi Perjalanan` form
  - Currency formatting for nominal inputs (transaksi/inject/return)
  - Modernized `Inject Dana` and `Return Sisa Dana (Final)` cards
  - shadcn `Select` for rekening picker (replacing native browser dropdown)
  - Added `Tanggal Inject` and `Tanggal Return` inputs in Dana Perjalanan
  - Added `Master Perusahaan` selector in Inject Dana form

- **Riwayat Saldo Rekening Compatibility Enhancement**
  - Extended `RiwayatSaldoRekening` schema with `ref_type` and `ref_id`
  - `transaksi_id` made optional to support non-`tt_finance_detail` balance events (trip inject/return)

- **Finance Aggregation Audit Trail (Existing Transaksi Module)**
  - Added `history` field to `tt_finance` aggregate model (`Transaksi`)
  - Added `history` field to `tt_finance_daily` for increment/decrement trace
  - Added `validator_notes_by` and `validator_notes_at` fields to `tt_finance_detail`
  - Added `perjalanan_dinas_id` reference field on `tt_finance_detail` for trip-origin traceability

- **Transaksi Validation Cross-check Tools (Existing Module)**
  - New action menu item `Cek Perjalanan Dinas` for transaksi rows linked to Perjalanan Dinas
  - New validator dialog to review trip header, summary, item details, and dana ledger before validation
  - In-dialog preview for Perjalanan Dinas item attachments (image/PDF) without opening new tab

### Changed
- **Audit Business Process (Perjalanan Dinas)**
  - After user submits trip to audit (`Selesai Perjalanan`), user can no longer edit transactions or attachments
  - Auditor now directly adjusts transaction nominal/keterangan in `Audit Item Perjalanan` (no revision roundtrip to user)
  - Audit table actions moved into dropdown menu to save horizontal table space

- **Trip Fund Summary Calculation**
  - `sisa_dana` now decreases immediately when trip transactions are created (based on total active trip transactions), not only after approval
  - Added `total_transaksi` display in summary cards for clarity

- **Inject / Return Dana Integration with Existing Transaksi Flow**
  - Inject Dana now creates draft transaksi (`tt_finance_detail`, unvalidated) and stores linked transaksi ID in dana ledger
  - Inject Dana now requires transaksi classification (`kategori`, `sub_kategori`, `akun`) plus company selection (`master perusahaan`)
  - Draft transaksi from inject now uses inject form `keterangan`, inject date, selected company, and source rekening (`kode_bank` / `no_rekening`)
  - Return Sisa Dana now supports custom date and can be executed during `SEDANG_DIAUDIT` or `SELESAI`

- **Perjalanan Dinas Final Posting Behavior**
  - Final posting now updates existing linked transaksi draft from the latest inject (no new transaksi created)
  - Final posting merges attachments from item perjalanan + inject + return into transaksi attachments (`tt_finance_detail`)
  - `Nilai yang akan diposting` formula changed to `Inject terakhir - Total Return`
  - Posting panel in Audit Perjalanan changed to read-only target inject summary + attachment merge preview

- **Sidebar Navigation Layout**
  - Sidebar footer changed from absolute positioning to normal flow (`mt-auto`) to avoid overlap with long menus
  - `Perjalanan Dinas`, `Transaksi Perjalanan`, `Dana Perjalanan`, `Audit Perjalanan` reorganized into one collapsible menu group

- **Perjalanan Dinas Header & Transaction Layout**
  - `Buat Header Perjalanan` action moved into `Daftar Perjalanan` card header (dialog trigger)
  - Removed separate header-create card so `Daftar Perjalanan` uses full available width
  - `Tambah Transaksi Perjalanan` action moved into `Daftar Item` card header (dialog trigger)
  - Redesigned `Buat Header Perjalanan` dialog with modern hero section, workflow summary, and grouped form layout

- **Perjalanan Dinas Workspace UI Redesign**
  - Redesigned `Pilih Perjalanan` card using shadcn `Select`, status badges, and selected-trip detail panel
  - Redesigned `Daftar Perjalanan` table with mini summary cards, richer row information, and improved action layout
  - Redesigned `Ledger Dana` table with mutation summary cards, styled `INJECT/RETURN` badges, and clearer nominal/rekening presentation
  - Redesigned `Audit Item Perjalanan` table with audit summary cards, improved attachment/bukti presentation, and compact actions
  - Redesigned `Finalisasi Audit & Posting` section into checklist + posting panels with shadcn `Select` fields

- **Perjalanan Dinas Web Navigation**
  - `Transaksi Perjalanan` menu entry is hidden from sidebar/internal web navigation because transaction input is now handled via mobile app

- **Transaksi Validation & Aggregation Behavior (Existing Module)**
  - `validateAttachment` now records validator identity and timestamp (`validator_notes_by`, `validator_notes_at`)
  - Daily aggregate update/decrement now stores history entries and preserves non-negative totals
  - Aggregate recalculation (`tt_finance`) now stores per-change history entries for better auditability
  - `updateValidatorNotes` response now returns validator metadata for UI refresh

- **Transaksi UI Action Rules (Existing Module)**
  - `Edit`, `Hapus`, `Upload`, and `Validasi` actions in transaction detail dropdown are hidden once item is validated
  - Validated rows now have stronger green hover/highlight styling for clearer visual distinction
  - Added contextual review action for Perjalanan Dinas-linked transactions to support validator re-check workflow

### Fixed
- **Sidebar Menu Overlap**
  - Fixed footer menu overlap/collision when navigation items increased in count

- **Attachment Preview UX in Audit**
  - Replaced new-tab proof preview with in-page dialog preview to avoid back-and-forth navigation

- **Role-based Login Feedback**
  - Changed website login rejection for role `user` from toast notification to dialog for clearer messaging

### Security
- **Role-based Access Enforcement for Perjalanan Dinas**
  - Backend role restrictions applied for create/inject/return/audit/finalize/posting actions
  - User scope restricted to assigned trips and edit access restricted after submit-to-audit

- **Website Access Restriction**
  - Role `user` is blocked from website login and directed to mobile app only

## [1.4.0] - 2026-02-16

### Added
- **Validator Notes Feature**: Comprehensive validator notes functionality for transaction validation
  - Input field for validator notes during transaction validation process
  - Separate dialog for adding/editing validator notes anytime (accessible via dropdown menu)
  - Validator notes column in transaction table showing notes or "-" if empty
  - Backend support with new `validator_notes` field in TtFinanceDetail model
  - New API endpoint `PUT /transaksi/validator-notes` for updating validator notes
  - Authorization restricted to superuser and corsec roles only

- **Attachment Preview Enhancement**: Improved attachment display and preview functionality
  - Mini preview button with eye icon for each attachment
  - Truncated filename display (max 80px width) with full name in tooltip
  - Consistent button sizing (4x4) for preview and delete actions
  - Direct preview opening in new tab for better user experience
  - Cleaner layout for multiple attachments in expanded transaction rows

### Changed
- **Transaction Validation Process**: Enhanced validation dialog to include optional validator notes input
- **Attachment Display**: Replaced direct links with truncated text and dedicated preview buttons
- **Table Layout**: Added Validator Notes column in Detail view with proper colspan adjustments

### Fixed
- **Attachment UI**: Resolved layout issues with long filenames by implementing truncation and tooltips
- **Button Consistency**: Standardized button sizes across attachment management interface

### Security
- **Role-based Access**: Validator notes functionality properly restricted to authorized personnel only

## [1.3.0] - 2026-02-04

### Added
- **Riwayat Saldo Rekening Page**: New comprehensive page for viewing account balance history
  - Modern UI with gradient backgrounds and responsive design
  - Account selection with bank code and account number dropdowns
  - Real-time balance information display with current account details
  - Detailed transaction history table showing balance changes over time
  - Date range filtering (start date and end date) for specific period analysis
  - Automatic sorting by creation date (descending - newest first)
  - Balance change visualization with color-coded income (+) and expenses (-)
  - Loading states and error handling with toast notifications
  - Empty state handling with helpful messages

- **Backend API Enhancements**:
  - New endpoint `/transaksi/riwayat-saldo-rekening` for fetching balance history
  - Date range filtering support with `start_date` and `end_date` parameters
  - Optimized MongoDB queries with proper indexing considerations
  - RiwayatSaldoRekening model for storing balance change history
  - Integration with transaction validation for automatic balance updates

- **UI/UX Improvements**:
  - Two-column layout for filter section and balance info (50% each)
  - Compact design with consistent spacing and modern styling
  - Responsive grid layouts for mobile and desktop
  - Enhanced sidebar navigation with new Riwayat Saldo menu item
  - Consistent color scheme with green theme for balance-related features

### Changed
- **Layout Optimization**: Filter and balance info sections now use equal-width two-column layout
- **Sorting Logic**: Changed from transaction date to creation timestamp for more accurate history ordering
- **Date Filtering**: Improved backend date range queries using MongoDB $gte and $lte operators

### Fixed
- **Dropdown Loading States**: Fixed clickable dropdown issues during initial load with proper loading states
- **Error Handling**: Enhanced error handling for API failures with user-friendly toast messages
- **Responsive Design**: Improved mobile responsiveness for filter inputs and balance display

## [1.0.4] - 2026-02-03

### Added
- Pagination with configurable page size (10, 25, 50, 100 items per page) in Subscriber page
- Backend endpoint `/subscriber/years` to fetch all available years from subscriber data
- Automatic page reset to 1 when date filters change in Transaksi page

### Changed
- Month and year filters in Subscriber page now processed on backend instead of frontend for better performance and accuracy
- Subscriber list now shows real-time data based on filters from entire database, not just current page

### Fixed
- Subscriber year dropdown now displays all available years from database instead of current page data
- Date filter aggregation pipeline in backend to handle string date fields properly
- Page automatically resets when changing date filters in Transaksi page to prevent empty results

## [1.2.0] - 2026-02-03

### Added
- Stacked bar chart for daily income breakdown in dashboard when a specific month is selected (not ANNUAL)
- New backend endpoint `/dashboard/pendapatan-harian` to fetch validated income transactions from finance_detail by day and subcategory
- Day formatting with leading zero (01-09) for consistent display in charts

### Changed
- Dashboard now shows additional chart for income transactions when month filter is applied

## [1.1.0] - 2026-02-03

### Added
- Update Log page to display changelog with fetching and rendering of CHANGELOG.md
- Pagination and search functionality to subscriber list
- Export Excel functionality on transaksi
- Validated color feature
- Button validasi for data validation
- Internal_kode field to Subscriber and Program models, with updated related components
- User management functionality with CRUD operations
- Update log route and sidebar item

### Changed
- Enhanced subscriber handling by kode
- Rekening model with saldo enhancements
- Implemented saldo updates in transaksi validation

### Fixed
- Updated user role check from 'superadmin' to 'superuser' in Sidebar component
- Fixed attachment link to use environment variable for API base URL
- Proteksi validasi data & revisi edit data (data validation protection and edit data revision)

## [1.0.3] - 2024-02-02

### Added
- Format currency pada field saldo saat edit rekening
- Input saldo menampilkan format Rupiah dengan pemisah ribuan
- Auto-formatting saat user selesai mengedit field saldo

### Changed
- Field saldo menggunakan input text dengan currency formatting
- Label saldo diubah menjadi "Saldo (Rp)" untuk kejelasan

### Fixed

## [0.1.0] - 2026-02-02

### Added
- Initial release of the finance application
- Dashboard with charts and reports
- User authentication and management
- Budget and transaction management
- VPS and subscriber tracking

### Changed

### Fixed
