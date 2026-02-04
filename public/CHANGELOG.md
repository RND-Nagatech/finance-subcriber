# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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