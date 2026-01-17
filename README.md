# Bexar County Foreclosure Scraper

An automated tool to scrape, analyze, and visualize foreclosure documents from Bexar County, Texas. It leverages AI (Google Gemini / Ollama) to extract detailed key content like Borrower, Lender, and Loan Amount from document images.

## Features
- **Scraper**: Puppeteer-based scraper to fetch document metadata and images.
- **AI Extraction**: Hybrid extraction pipeline using:
  - **Regex/OCR**: Tesseract.js for basic extraction.
  - **Gemini Vision**: Google's Gemini 2.0 Flash Lite for high-accuracy parsing.
  - **Local AI**: Support for Ollama (Moondream/LLaVA) for private, free extraction.
- **Dashboard**: Interactive web dashboard to view, filter, and map foreclosure properties.
- **Geocoding**: Automatic address geocoding for map visualization.

## Quick Start

### Prerequisites
- Node.js (v18+)
- Google Cloud API Key (for Gemini)
- (Optional) Ollama installed for local AI

### Installation
```bash
npm install
```

### Usage

1. **Scrape Data**
   ```bash
   npm run start
   ```

2. **Run AI Extraction**
   ```bash
   export GEMINI_API_KEY="your_key_here"
   npx ts-node src/extract_gemini.ts
   ```

3. **Update Dashboard Data**
   ```bash
   node dashboard/convert-data.js
   ```

4. **Launch Dashboard**
   ```bash
   npx http-server dashboard -p 3000
   ```
   Visit `http://localhost:3000`

## Project Structure
- `src/`: TypeScript source code for scraping and extraction.
- `dashboard/`: Web frontend (HTML/JS/CSS).
- `output/`: Raw data artifacts (CSV).
- `dist/`: Compiled JavaScript.

## License
Proprietary / Private Use.
