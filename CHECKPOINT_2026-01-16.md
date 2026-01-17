# Project Checkpoint: 2026-01-16

## Project Overview
**Name**: `bexar-county-scraper`
**Description**: A comprehensive tool to scrape, geocode, analyze, and visualize foreclosure documents from Bexar County. It includes a web dashboard for viewing data and uses AI (Gemini/Ollama) to extract detailed borrower and lender information.

## Tech Stack
- **Language**: TypeScript / Node.js
- **Scraping**: `puppeteer`
- **Data Processing**: `csv-parse`, `csv-writer`, `ml-hclust` (clustering)
- **AI & OCR**:
  - **Google Gemini**: `@google/generative-ai` (Model: `gemini-2.0-flash-lite`)
  - **Local AI**: `ollama` (via `axios`), `sharp` (image optimization)
  - **OCR**: `tesseract.js`
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (Dashboard)

## Folder Structure
```
.
├── dashboard/               # Web interface
│   ├── data/                # JSON data files for dashboard
│   ├── index.html           # Main view
│   ├── app.js               # Dashboard logic (filtering, map)
│   ├── styles.css           # Styling
│   └── convert-data.js      # Script to convert CSV to JSON
├── output/                  # Data artifacts
│   ├── bexar_documents.csv  # Raw scraped data
│   └── bexar_documents_updated.csv # AI-enriched data
├── src/                     # Source code
│   ├── config.ts            # Configuration constants
│   ├── scraper.ts           # Main scraping logic
│   ├── extractor.ts         # Initial regex-based extraction
│   ├── extract_parties.ts   # Advanced regex extraction
│   ├── extract_gemini.ts    # Google Gemini extraction script
│   ├── extract_ollama.ts    # Local Ollama extraction script
│   ├── geocoder.ts          # Geocoding logic
│   ├── zoning.ts            # Zoning analysis
│   └── normalizer.ts        # Data normalization
└── package.json             # Dependencies
```

## Integrations
- **Google Gemini API**: Used for high-accuracy extraction of Borrower, Lender, and Loan Amount.
  - **Env Var**: `GEMINI_API_KEY`
- **Ollama (Local)**: Fallback/Alternative extraction using local LLMs (Moondream/LLaVA).
  - **Endpoint**: `http://localhost:11434`
- **Bexar County Public Search**: Source of document images and metadata.

## Database / Data Models
- Data is stored in **CSV** files (`output/*.csv`) and converted to **JSON** (`dashboard/data/*.json`) for the frontend.
- **Key Fields**: `doc_id`, `borrower_owner_name`, `lender_name`, `loan_amount`, `property_address`, `zone_id`.

## Recent Changes
- **AI Extraction**: Implemented both Cloud (Gemini) and Local (Ollama) pipelines to fix missing data.
- **Dashboard Filters**: Added column-based filtering for Borrower, Lender, Amount, etc.
- **Optimization**: Added image resizing (`sharp`) for faster local inference.

## Known Issues / TODOs
- **AI Coverage**: A small percentage (<5%) of documents return "None" due to image quality or non-standard formats.
- **Local AI Speed**: Ollama on CPU is slow; Gemini is preferred.
- **Quota**: Gemini Free Tier has rate limits (15 RPM), requiring batch processing delays (handled in script).

## Cleanup Completed (2026-01-16)
- Removed debug scripts: `src/debug_ollama.ts`, `src/test_gemini_quota.ts`
- Removed temporary logs and artifacts: `ollama.log`, `debug_ocr_screenshot.png`, `output/run_log.txt`
