# Bexar County Foreclosure Scraper

Automated tool to scrape, analyze, and visualize foreclosure documents from Bexar County, Texas. Uses AI (Google Gemini / Ollama) to extract Borrower, Lender, and Loan Amount data.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Run the dashboard
npm run dashboard
# Open http://localhost:8000
```

## Features
- **Automated Scraping**: Puppeteer-based scraper for Bexar County public records
- **AI Extraction**: Hybrid pipeline using Cloud (Gemini) or Local (Ollama) AI
- **Interactive Dashboard**: Filterable table + Leaflet map with zone clustering
- **Status Tracking**: Persist property statuses across sessions

## Tech Stack
| Category | Technology |
|----------|-----------|
| Backend | Node.js, TypeScript |
| Scraping | Puppeteer |
| AI | Google Gemini, Ollama |
| Frontend | Vanilla JS, Leaflet |
| Data | CSV, JSON |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dashboard` | Start dashboard server (port 8000) |
| `npm run dev` | Run main scraper |
| `npm run build` | Compile TypeScript |

## Project Structure
```
├── src/                 # TypeScript source
├── dashboard/           # Web frontend
├── output/              # Data files (CSV)
├── checkpoints/         # Project snapshots
└── docs/                # Documentation
```

## Documentation
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [CHANGELOG.md](./CHANGELOG.md) - Version history
- [DECISIONS.md](./DECISIONS.md) - Technical choices
- [TODO.md](./TODO.md) - Backlog & ideas

## Requirements
- Node.js 18+
- Google Gemini API key (for AI extraction)
- Optional: Ollama for local AI

## License
Private / Proprietary
