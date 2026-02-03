# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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