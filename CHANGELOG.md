# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-01-19
### Added
- `ARCHITECTURE.md` - System design documentation
- `CHANGELOG.md` - Version history
- `DECISIONS.md` - Technical decision log
- `.env.example` - Environment template
- `/checkpoints` folder for periodic snapshots

### Changed
- Updated `README.md` with comprehensive setup instructions
- Reorganized checkpoint files

### Removed
- `src/debug_analyze_failures_v2.ts` - Debug script cleanup
- `CHECKPOINT_2026-01-16.md` - Superseded

## [1.0.0] - 2026-01-17
### Added
- Dashboard server with status persistence (`server.js`)
- Status column in dashboard table
- Map navigation from table rows
- Enhanced marker styles

### Changed
- Dashboard now runs on port 8000 (with API support)

## [0.9.0] - 2026-01-16
### Added
- Google Gemini AI extraction (`extract_gemini.ts`)
- Local Ollama AI extraction (`extract_ollama.ts`)
- Image resizing with Sharp for faster inference
- Dashboard column filters

### Fixed
- Extraction accuracy improved from ~30% to ~95%
- Timeout handling for slow AI responses

## [0.1.0] - 2026-01-15
### Added
- Initial project setup
- Puppeteer scraper for Bexar County
- Tesseract.js OCR extraction
- Basic dashboard with Leaflet map
- Zone clustering with ml-hclust
