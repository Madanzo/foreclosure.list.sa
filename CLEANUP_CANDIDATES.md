# Cleanup Candidates (2026-01-19)

## Files Flagged for Removal

### Debug/Temporary Scripts
| File | Reason | Size |
|------|--------|------|
| `src/debug_analyze_failures_v2.ts` | Debug script, no longer needed | ~5KB |

### Build Artifacts (Optional)
| Directory | Reason | Note |
|-----------|--------|------|
| `dist/` | Compiled JS, can be regenerated | Keep if deploying without build step |

### Binary/Data Files
| File | Reason | Size |
|------|--------|------|
| `eng.traineddata` | Tesseract language file | ~5MB |

> **Note**: Keep `eng.traineddata` if using Tesseract OCR fallback.

### Old Documentation
| File | Reason |
|------|--------|
| `CHECKPOINT_2026-01-16.md` | Superseded by today's checkpoint |
| `CLEANUP_CANDIDATES.md` | Old cleanup list (this replaces it) |

## Dependencies Review
All current dependencies appear to be in use:
- ✅ `@google/generative-ai` - Used in `extract_gemini.ts`
- ✅ `axios` - Used for Ollama API calls
- ✅ `csv-parse`, `csv-writer` - CSV processing
- ✅ `ml-hclust` - Zone clustering
- ✅ `puppeteer` - Web scraping
- ✅ `sharp` - Image resizing for AI
- ✅ `tesseract.js` - OCR extraction

## Console.log Audit
- `src/extract_parties.ts`: Contains console.logs for progress (acceptable)
- `dashboard/app.js`: Contains debug logs (could be cleaned)

## Summary
| Category | Count | Est. Size |
|----------|-------|-----------|
| Debug scripts | 1 | ~5KB |
| Old checkpoints | 2 | ~8KB |
| Binary data (optional) | 1 | ~5MB |
| Build artifacts (optional) | 1 dir | ~200KB |
| **Total (safe to remove)** | **3 files** | **~13KB** |
| **Total (including optional)** | **4+ items** | **~5.2MB** |

## Files Needing Manual Review
- `dist/` - Keep if you prefer pre-compiled deployment
- `eng.traineddata` - Keep if using Tesseract OCR
