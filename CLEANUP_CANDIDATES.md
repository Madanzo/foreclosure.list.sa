# Cleanup Candidates

## Unnecessary Files
These files were created for debugging or temporary steps and can be safely removed:
- `src/debug_ollama.ts` - Debug script for Moondream
- `src/test_gemini_quota.ts` - Debug script for API connectivity
- `debug_ocr_screenshot.png` - Temporary artifact
- `ollama.log` - Server log
- `output/run_log.txt` - Runtime log (can be cleared)

## Potential Removals (Review Needed)
- `eng.traineddata` - Tesseract language file (~20MB). If we rely solely on Gemini/Ollama, this is not needed.
- `src/extract_ollama.ts` - If we are committed to Gemini, the local extraction script might be redundant (keep for backup?).

## Dependencies
- `tesseract.js` - Currently used in `src/extract_parties.ts`. **KEEP** for now as legacy fallback, or remove if we fully deprecate the Regex/OCR path.

## Empty/Temp Folders
- None identified.
