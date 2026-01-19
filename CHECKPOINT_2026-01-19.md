# Project Checkpoint: 2026-01-19

## Project Overview
**Name**: `bexar-county-scraper`  
**Version**: 1.0.0  
**Description**: Automated tool to scrape, geocode, analyze, and visualize foreclosure documents from Bexar County, Texas. Uses AI (Gemini/Ollama) to extract Borrower, Lender, and Loan Amount data.

## Tech Stack
| Category | Technology | Version |
|----------|-----------|---------|
| Language | TypeScript / Node.js | TS 5.3.3 |
| Scraping | Puppeteer | 21.7.0 |
| AI - Cloud | Google Gemini (`@google/generative-ai`) | 0.24.1 |
| AI - Local | Ollama (via `axios`) | 1.13.2 |
| Image Processing | Sharp | 0.34.5 |
| OCR | Tesseract.js | 7.0.0 |
| CSV Processing | csv-parse, csv-writer | 6.1.0, 1.6.0 |
| Clustering | ml-hclust | 3.1.0 |
| Frontend | HTML5, CSS3, Vanilla JS | - |

## Folder Structure
```
├── src/                    # TypeScript source
│   ├── config.ts           # Configuration constants
│   ├── scraper.ts          # Main scraping logic
│   ├── extractor.ts        # Initial extraction
│   ├── extract_parties.ts  # Regex-based extraction
│   ├── extract_gemini.ts   # Gemini AI extraction
│   ├── extract_ollama.ts   # Local AI extraction
│   ├── geocoder.ts         # Address geocoding
│   ├── zoning.ts           # Zone clustering
│   ├── normalizer.ts       # Data normalization
│   └── tests/              # Test files
├── dashboard/              # Web frontend
│   ├── index.html          # Main UI
│   ├── app.js              # Dashboard logic
│   ├── styles.css          # Styling
│   ├── server.js           # Node.js server (port 8000)
│   ├── convert-data.js     # CSV to JSON converter
│   └── data/               # JSON data files
├── output/                 # Data artifacts (CSV)
├── dist/                   # Compiled JS (build output)
└── docs/                   # Documentation
```

## Key Files
| File | Purpose |
|------|---------|
| `src/extract_gemini.ts` | AI extraction using Google Gemini API |
| `src/extract_parties.ts` | Regex/OCR-based party extraction |
| `dashboard/server.js` | Express-like server with status persistence |
| `dashboard/convert-data.js` | Converts CSV data to JSON for dashboard |
| `output/bexar_documents_updated.csv` | Primary data with extracted fields |

## Environment Variables
| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Google Gemini API authentication |

## Integrations
- **Google Gemini API**: Cloud AI for document analysis
- **Ollama**: Local LLM fallback (Moondream/LLaVA)
- **Bexar County Public Search**: Source of foreclosure documents

## Data Models
**DocumentRecord** (CSV/JSON):
- `doc_id`, `recorded_date`, `instrument_date`
- `borrower_owner_name`, `lender_name`, `loan_amount`
- `property_address`, `city`, `zip`, `lat`, `lng`, `zone_id`
- `doc_url`

## Recent Changes (Since 2026-01-16)
- Added `dashboard/server.js` for status persistence (port 8000)
- Added `dashboard/data/status.json` for tracking property statuses
- Enhanced `dashboard/app.js` with status column and map navigation
- Improved marker styles in the dashboard

## Known Issues / TODOs
- ~5% of documents return "None" for extraction (image quality issues)
- Local AI (Ollama) performance is slow on CPU
- Some audit vulnerabilities in dependencies (7 total per npm audit)

## Next Steps
- Manual review of "None" extraction results
- Consider GPU setup for faster local AI
- Address npm audit vulnerabilities

---

## Cleanup Completed (2026-01-19)
**Files Removed:**
- `src/debug_analyze_failures_v2.ts` - Debug script
- `CHECKPOINT_2026-01-16.md` - Superseded checkpoint

**Build Verification:** ✅ Passed (tsc)
