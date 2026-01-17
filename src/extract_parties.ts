// Batch extraction of parties (Borrower, Lender) from document images via OCR
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { createWorker } from 'tesseract.js';
import { createObjectCsvWriter } from 'csv-writer';

// Configuration
const BATCH_SIZE = 10; // Process in small batches
const CSV_PATH = path.join(__dirname, '../output/bexar_documents.csv');
const OUTPUT_CSV_PATH = path.join(__dirname, '../output/bexar_documents_updated.csv');

interface DocumentRecord {
    doc_id: string;
    recorded_date: string;
    instrument_date: string;
    borrower_owner_name: string;
    lender_name: string;
    loan_amount: string; // New field
    property_address: string;
    city: string;
    zip: string;
    lat: string;
    lng: string;
    zone_id: string;
    doc_url: string;
}

// Helper to read CSV
function readCSV(filePath: string): DocumentRecord[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',');

    return lines.slice(1).map(line => {
        // Handle quoted fields logic (simplified)
        const values: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());

        const obj: any = {};
        headers.forEach((h, i) => obj[h.trim()] = values[i]?.replace(/^"|"$/g, '') || '');
        return obj as DocumentRecord;
    });
}

// Custom type for extraction result
interface ExtractionResult {
    borrower: string;
    lender: string;
    loan_amount: string;
    trustee: string;
}

function extractParties(text: string): ExtractionResult {
    // Normalize text: remove newlines, collapse spaces
    const cleanText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ');

    // Debug log limited text
    // console.log('OCR Text Start:', cleanText.substring(0, 200));

    // Strategies to find Borrower
    // 1. "WHEREAS, on [Date], [Name] executed"
    // 2. "Grantor: [Name]"
    // 3. "Borrower: [Name]"

    let borrower = '';

    const borrowerPatterns = [
        // NEW: Grantor(s) with parentheses - VERY IMPORTANT for Bexar docs
        /Grantor\s*\(?s?\)?[:\s]+(.*?)(?:\s+Original\s+Mortgagee|\s+Property\s+Address|\s+and\s+|,\s*(?:an?|a)\s+)/i,
        // NEW: County Texas patterns (very common in Bexar documents)
        /County\s+Texas\s+with\s+(.*?)\s+(?:as\s+Grantor|An?\s+|and\s+)/i,
        /records\s+of\s+BEXAR\s+County\s+Texas\s+with\s+(.*?)(?:\s+as\s+|,|\s+An?\s+)/i,
        // NEW: NOTICE OF TRUSTEE'S SALE patterns
        /property\s+owned\s+by\s+(.*?)(?:,|\.|\s+located)/i,
        /NOTICE\s+OF\s+TRUSTEE.*?property.*?owned\s+by\s+(.*?)(?:,|\.)/i,
        // NEW: Obligor pattern
        /Obligor[:\s]+(.*?)(?:,|\s+and|\s+a\s+)/i,
        // NEW: "Grantor/Borrower" variations
        /Grantor\/Borrower[:\s]*(.*?)(?:,|\s+and|\s+a\s+)/i,
        // Specific Patterns first
        // "Obligation(s) Secured: ... executed by [Name] ... secures/securing"
        /Obligations?\s+Secured[:.]?.*?\s+executed\s+by\s+(.*?)(?:,\s+securing|\s+securing|\s+secures|\s+and)/i,
        // "with [Name], grantor(s)"
        /with\s+(.*?),\s+grantors?/i,
        /Grantor:\s*(.*?)(?:,\s+(?:an?\s+|a\s+|as\s+)|\s+and|\s+a\s+)/i,
        /Borrower:\s*(.*?)(?:,\s+(?:an?\s+|a\s+|as\s+)|\s+and|\s+a\s+)/i,
        // Generic / Standard patterns
        /WHEREAS.*?\s+on\s+.*?\d{4},?\s+(.*?)(?:,\s+(?:an?\s+|a\s+|as\s+|executed)|,\s+Grantor|\s+as\s+Grantor)/i,
        /WHEREAS.*?\s+on\s+.*?,?\s+(.*?)(?:,\s+(?:an?\s+|a\s+|as\s+|executed)|,\s+Grantor|\s+as\s+Grantor)/i,
        /executed\s+by\s+(.*?)(?:,\s+(?:an?\s+|a\s+|as\s+)|$)/i
    ];

    for (const p of borrowerPatterns) {
        const m = cleanText.match(p);
        if (m && m[1]) {
            // Clean up trailing punctuation or noise captured
            let name = m[1].replace(/,\s*$/, '').trim();
            // Remove 'an unmarried man' etc if it leaked in
            name = name.replace(/,\s*(?:an?|a)\s+.*$/, '');
            // Clean leading digits/separators (e.g. from bad date capture)
            name = name.replace(/^[\d\s,]+/, '');

            if (name.length < 50 && name.length > 2) {
                borrower = name;
                break;
            }
        }
    }

    // Strategies to find Lender
    // 1. "payable to the order of [Name]" (High confidence)
    // 2. "Lender: [Name]"
    // 3. "Mortgagee: [Name]"

    let lender = '';
    const lenderPatterns = [
        // NEW: Current Mortgagee patterns (very common)
        /Current\s+Mortgagee:\s*(.*?)(?:\s+Mortgagee|\s+Address|\s+whose|$)/i,
        /Current\s+Beneficiary[:\s]*(.*?)(?:\s+Recorded|\s+Address|\s+whose|$)/i,
        // NEW: Mortgage Servicer patterns
        /Mortgage\s+Servicer[:\s]*(.*?)(?:\s+is\s+|\s+whose|\s+at\s+)/i,
        // NEW: Direct bank/trust name patterns
        /([A-Z][A-Z\s.,&-]+(?:BANK|TRUST|MORTGAGE|LLC|INC|N\.?A\.?)[A-Z\s.,&-]*)\s+(?:is\s+the|as\s+)/i,
        // NEW: "in favor of [Lender]"
        /in\s+favor\s+of\s+(.*?)(?:,\s+its|\s+recorded|\s+and\s+)/i,

        /payable\s+to\s+the\s+order\s+of\s+(.*?)(?:,|\s+which)/i, // High priority
        // "Mortgagee: [Name]" - Stop at digits (address start) or 'and'/'a'
        /Mortgagee:\s*(.*?)(?:\s+\d|\s+and|\s+a\s+)/i,
        /benefit\s+of\s+(.*?)\s+(?:recorded|and|a\s+)/i,
        /Lender:\s*(.*?)(?:\s+and|\s+a\s+)/i,
        /Mortgagee:\s*(.*?)(?:\s+and|\s+a\s+)/i,
        /to\s+(.*?)\s+as\s+Trustee/i,
        // "[Lender] as Beneficiary"
        /([A-Z\s.,&]+?)\s+,?\s*as\s+Beneficiary/i,
        // "... [Lender] is the current mortgagee"
        /([A-Z\s.,&]+?)\s+,?\s*whose\s+address\s+is.*?\s+is\s+the\s+current\s+mortgagee/i,
        // Strict match for "is the current mortgagee"
        /([A-Z][A-Za-z0-9\s.,&-]+?)\s+(?:[Ii]s\s+[Tt]he\s+[Cc]urrent\s+[Mm]ort)/,

        // Robust "whose address" match for sloppy OCR
        /([A-Z\s.,&]+?)\s+,?\s*whose\s+addr/i,
        /([A-Z\s.,&]+?)\s+,?\s*whose\s+address/i,
        // Fallback for "current mortgagee" with missing "is the"
        /([A-Z\s.,&]+?)\s+,?\s*.*?current\s+mortgagee/i
    ];

    for (const p of lenderPatterns) {
        const m = cleanText.match(p);
        if (m && m[1]) {
            let name = m[1].trim();
            // Clean up if it grabbed "10:00 AM" or similar noise
            if (name.match(/^\d+:\d+\s+AM$/)) continue; // Skip timestamps

            // If pattern captures too much (start of sentence), try to take last chunk?
            // For now assume uppercase helps or short length
            if (name.length < 150 && name.length > 2) {
                lender = name;
                break;
            }
        }
    }

    let loan_amount = '';
    const amountPatterns = [
        // Robust amount match: allow spaces between digits/commas/dots (e.g. "$ 71, 354 . 00")
        /original\s+amount\s+of\s+\$\s*([\d\s,]+(?:\.\s*\d{2})?)/i,
        /principal\s+sum\s+of\s+\$\s*([\d\s,]+(?:\.\s*\d{2})?)/i,
        /repayment\s+of\s+a\s+Note.*?\s+\$\s*([\d\s,]+(?:\.\s*\d{2})?)/i,
        // Relaxed fallback
        /\$\s*([\d\s,]+(?:\.\s*\d{2})?)[.,\s]/
    ];

    for (const p of amountPatterns) {
        const m = cleanText.match(p);
        if (m && m[1]) {
            loan_amount = m[1];
            break;
        }
    }

    // Fallback: Check if document explicitly says "debt therein described" (common in partial Foreclosure notices)
    // implying the amount is NOT in this document.
    if (!loan_amount) {
        if (/debt\s+therein\s+described|indebtedness\s+therein\s+described/i.test(cleanText)) {
            loan_amount = "See Referenced Deed";
        }
    }

    // Cleanup
    const clean = (s: string) => s.replace(/[",;]/g, '').trim();

    return {
        borrower: clean(borrower),
        lender: clean(lender),
        loan_amount: clean(loan_amount),
        trustee: ''
    };
}

function cleanAmount(val: string): string {
    if (!val) return '';
    // Remove non-numeric except dot
    let v = val.replace(/[^0-9.]/g, '');
    // Handle '385.000.00' scenario
    const parts = v.split('.');
    if (parts.length > 2) {
        // Join all but last
        const decimal = parts.pop();
        v = parts.join('') + '.' + decimal;
    }
    return v;
}

async function main() {
    console.log('Starting batch extraction of parties...');

    // Read from updated CSV if it exists to resume progress
    const inputPath = fs.existsSync(OUTPUT_CSV_PATH) ? OUTPUT_CSV_PATH : CSV_PATH;
    console.log(`Reading input from ${inputPath}`);

    const docs = readCSV(inputPath);
    // Filter for documents that satisfy the condition: no borrower AND no lender
    const pendingDocs = docs.filter(d =>
        (!d.borrower_owner_name || d.borrower_owner_name.trim() === '') ||
        (!d.lender_name || d.lender_name.trim() === '') ||
        (!d.loan_amount || d.loan_amount.trim() === '') // Re-process if amount missing
    );

    console.log(`Total documents: ${docs.length}`);
    console.log(`Pending extraction: ${pendingDocs.length}`);

    if (pendingDocs.length === 0) {
        console.log('All documents already processed.');
        return;
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const worker = await createWorker();
    // await worker.loadLanguage('eng');
    // await worker.initialize('eng');

    // Helper to save progress
    const saveProgress = async () => {
        const csvWriter = createObjectCsvWriter({
            path: OUTPUT_CSV_PATH,
            header: [
                { id: 'doc_id', title: 'doc_id' },
                { id: 'recorded_date', title: 'recorded_date' },
                { id: 'instrument_date', title: 'instrument_date' },
                { id: 'borrower_owner_name', title: 'borrower_owner_name' },
                { id: 'lender_name', title: 'lender_name' },
                { id: 'loan_amount', title: 'loan_amount' }, // Added
                { id: 'property_address', title: 'property_address' },
                { id: 'city', title: 'city' },
                { id: 'zip', title: 'zip' },
                { id: 'lat', title: 'lat' },
                { id: 'lng', title: 'lng' },
                { id: 'zone_id', title: 'zone_id' },
                { id: 'doc_url', title: 'doc_url' }
            ]
        });
        await csvWriter.writeRecords(docs);
        console.log(`Saved progress to ${OUTPUT_CSV_PATH}`);
    };

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
        await page.setViewport({ width: 1280, height: 1600, deviceScaleFactor: 2 });

        // Process all pending documents
        const batch = pendingDocs;

        for (const [index, doc] of batch.entries()) {
            console.log(`Processing ${doc.doc_id}...`);

            let attempts = 0;
            const MAX_RETRIES = 3;
            let success = false;

            while (attempts < MAX_RETRIES && !success) {
                attempts++;
                if (attempts > 1) {
                    console.log(`  [Retry ${attempts}/${MAX_RETRIES}] Incomplete data. Reloading page and waiting longer...`);
                }

                try {
                    // Navigate only on first attempt or if reloading
                    if (attempts === 1) {
                        await page.goto(doc.doc_url, { waitUntil: 'networkidle2' });
                    } else {
                        await page.reload({ waitUntil: 'networkidle2' });
                    }

                    // Wait specifically for SVG or Canvas
                    try {
                        await page.waitForSelector('svg, canvas, img', { timeout: 15000 });
                    } catch (e) { }

                    // Increasing wait time: 4s, 8s, 12s
                    const waitTime = 4000 * attempts;
                    await new Promise(r => setTimeout(r, waitTime));

                    // First, try to extract text directly from page (more reliable than OCR)
                    let pageText = '';
                    try {
                        pageText = await page.evaluate(() => {
                            // Get all text from the sidebar/summary panel
                            const textNodes = document.querySelectorAll('body *');
                            let allText = '';
                            textNodes.forEach(node => {
                                if (node.childNodes.length === 1 && node.childNodes[0].nodeType === 3) {
                                    allText += ' ' + (node.textContent || '');
                                }
                            });
                            return allText;
                        });
                    } catch (e) { }

                    const buffer = await page.screenshot({ fullPage: true });

                    // Save first screenshot for debug
                    if (index === 0 && attempts === 1) { // Only save on first attempt of first doc
                        fs.writeFileSync('debug_ocr_screenshot.png', buffer);
                        // console.log('Saved debug_ocr_screenshot.png');
                    }

                    const ret = await worker.recognize(buffer);
                    // Combine page text (cleaner) with OCR text (backup)
                    const combinedText = pageText + ' ' + ret.data.text;
                    let { borrower, lender, loan_amount } = extractParties(combinedText);

                    // INLINED CLEANUP LOGIC TO ENSURE IT APPLIES ON RETRY
                    if (lender) {
                        // TVLB Cleanup: If it captured "Rodolfo Espinoza. Texas Veterans Land Board", just keep "Texas Veterans Land Board"
                        if (lender.match(/Texas\s+Veterans\s+Land\s+Board/i)) {
                            lender = "Texas Veterans Land Board";
                        }

                        lender = lender
                            .replace(/^(?:AM|PM)\s+/, '') // Timestamp residuals
                            .replace(/.*\bDeed\s+of\s+Trust\s+in\s+favor\s+of\s+/i, '')
                            .replace(/.*\bcertain\s+Deed\s+of\s+Trust\s+/i, '')
                            .replace(/,\s*as\s+.*$/, '') // Strip trailing "as nominal...", "as beneficiary"
                            .replace(/as\s+nominee\s+for\s+/i, '')
                            // NEW: Remove mortgage servicer trailing info
                            .replace(/\s+Mortgage\s+Servicer[:\s].*$/i, '')
                            .replace(/\s+Mortgagee\s+Address[:\s].*$/i, '')
                            // NEW: Remove "Information. The..." noise
                            .replace(/^Information\.\s*/i, '')
                            .replace(/\s+Information\.\s+.*$/i, '')
                            // NEW: Remove street addresses at end
                            .replace(/\s+\d+\s+\w+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr)\s*.*$/i, '')
                            // NEW: Remove copyright/branding
                            .replace(/\s+©.*$/i, '')
                            .replace(/\s+Bexar\s+County\s+Texas.*$/i, '')
                            // NEW: Remove "Property" trailing
                            .replace(/\s+Property\s*$/i, '')
                            // NEW: Remove "it" at end (OCR artifact)
                            .replace(/\s+it\s*$/i, '')
                            .replace(/\s+i\s*$/i, '')
                            .trim();
                        const nomineeMatch = lender.match(/nominee\s+for\s+(.*?)(?:$|,)/i);
                        if (nomineeMatch) {
                            lender = nomineeMatch[1];
                        }
                    }

                    let finalAmount = '';
                    if (loan_amount) {
                        // Skip cleaning if it's our text fallback
                        if (loan_amount.includes("Referenced Deed")) {
                            finalAmount = loan_amount;
                        } else {
                            // Remove spaces and commas
                            const cleanVal = loan_amount.replace(/[\s,]/g, '');
                            const dotCount = (cleanVal.match(/\./g) || []).length;

                            // Handle '385.000.00' scenario (thousands separators as dots)
                            if (dotCount > 1) {
                                // Likely thousands separators read as dots. Remove all but last.
                                // Assumption: Last dot is decimal separator.
                                // This logic was commented out in the original, keeping it as is.
                            }
                            finalAmount = cleanAmount(loan_amount);
                        }
                    }
                    loan_amount = finalAmount;

                    // CHECK SUCCESS
                    const hasBorrower = borrower && borrower !== 'None';
                    const hasLender = lender && lender !== 'None';
                    const hasAmount = loan_amount && loan_amount !== 'None';

                    if (hasBorrower && hasLender && hasAmount) {
                        success = true;
                    } else if (attempts === MAX_RETRIES) {
                        console.log(`  [Give Up] Max retries reached. Keeping best effort.`);
                    }

                    // Log Current Attempt Result
                    console.log(`  Borrower: ${borrower || 'None'}`);
                    console.log(`  Lender: ${lender || 'None'}`);
                    console.log(`  Amount: ${loan_amount || 'None'}`);

                    // Update doc object (always update with latest attempt)
                    const originalDoc = docs.find(d => d.doc_id === doc.doc_id);
                    if (originalDoc) {
                        originalDoc.borrower_owner_name = borrower;
                        originalDoc.lender_name = lender;
                        originalDoc.loan_amount = loan_amount;
                    }

                } catch (e) {
                    console.error(`  Error on attempt ${attempts}:`, e);
                    // If navigation fails, we loop to retry
                }

                // If we found everything, break early
                if (success) break;
            }

            // Save every 5 docs
            if ((index + 1) % 5 === 0) {
                await saveProgress();
            }

        }

    } finally {
        await worker.terminate();
        await browser.close();
    }

    // Final save
    await saveProgress();
}

main();
