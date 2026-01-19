# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA PIPELINE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐ │
│  │ Scraper  │───▶│ Extractor │───▶│ Geocoder │───▶│ Exporter │ │
│  │(Puppeteer)│   │ (AI/OCR)  │    │  (API)   │    │  (CSV)   │ │
│  └──────────┘    └───────────┘    └──────────┘    └──────────┘ │
│       │                │                               │        │
│       ▼                ▼                               ▼        │
│  Bexar County    Gemini API /               output/*.csv        │
│  Public Search   Ollama Local                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DASHBOARD                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ convert-data │───▶│   app.js     │◀──▶│  server.js   │      │
│  │   (CSV→JSON) │    │ (Frontend)   │    │ (Port 8000)  │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                             │                    │              │
│                             ▼                    ▼              │
│                      Leaflet Map          Status Persistence    │
│                      Data Table           (status.json)         │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **Scrape** → Puppeteer navigates Bexar County site, captures document metadata
2. **Extract** → AI (Gemini/Ollama) or OCR (Tesseract) extracts Borrower/Lender/Amount
3. **Geocode** → Property addresses converted to lat/lng coordinates
4. **Cluster** → Properties grouped into zones using ml-hclust
5. **Export** → Data saved to CSV files
6. **Convert** → `convert-data.js` transforms CSV to JSON for dashboard
7. **Display** → Dashboard renders interactive map and filterable table

## Component Relationships

| Component | Depends On | Outputs |
|-----------|-----------|---------|
| `scraper.ts` | Puppeteer, config | Raw document data |
| `extract_gemini.ts` | @google/generative-ai, Puppeteer | Enriched records |
| `extract_ollama.ts` | axios, sharp | Enriched records (local) |
| `geocoder.ts` | axios | Lat/lng coordinates |
| `zoning.ts` | ml-hclust | Zone assignments |
| `dashboard/app.js` | Leaflet, documents.json | Interactive UI |
| `dashboard/server.js` | Node.js http | API endpoints |

## Key Files

| File | Purpose |
|------|---------|
| `src/config.ts` | Constants, URLs, selectors |
| `src/index.ts` | Main entry point, orchestrates pipeline |
| `dashboard/server.js` | Serves dashboard, handles status API |
