# Technical Decisions

This document explains *why* key technical choices were made.

## AI Extraction Strategy

### Why Gemini over local-only?
- **Speed**: Gemini processes documents in 2-3 seconds vs 60+ seconds for local models
- **Accuracy**: Cloud models have better OCR and context understanding
- **Fallback**: Ollama (local) exists as backup when API is unavailable

### Why keep Tesseract.js?
- **Cost-free**: No API charges for basic extraction
- **Offline**: Works without internet
- **Fallback**: Regex patterns still extract ~30% of documents correctly

## Dashboard Architecture

### Why vanilla JS instead of React/Vue?
- **Simplicity**: Single-page app with no build step needed
- **Speed**: Instant reload during development
- **Dependencies**: Zero frontend dependencies = smaller bundle

### Why separate server.js (port 8000)?
- **Persistence**: `http-server` is static-only; we needed POST for status updates
- **Future-proof**: Easy to add more API endpoints later

## Data Storage

### Why CSV over database?
- **Portability**: Easy to open in Excel, share with non-technical users
- **Simplicity**: No database setup or migrations
- **Size**: 400 documents = ~50KB, DB overhead not justified

### Why JSON for dashboard?
- **Performance**: Direct array access, no parsing needed
- **Caching**: Browser can cache the entire dataset

## Dependency Choices

| Package | Why chosen |
|---------|-----------|
| `puppeteer` | Best-in-class headless browser, reliable for scraping |
| `sharp` | Fastest image resizing in Node.js ecosystem |
| `ml-hclust` | Lightweight clustering without heavy ML dependencies |
| `axios` | Simpler API than native fetch for Ollama integration |
