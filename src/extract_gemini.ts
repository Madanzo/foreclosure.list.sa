/**
 * Gemini Vision-based extraction for foreclosure documents
 * Uses Google Gemini 1.5 Flash FREE tier (15 req/min)
 * 
 * Setup:
 * 1. Get API key from https://aistudio.google.com/apikey
 * 2. Set environment variable: export GEMINI_API_KEY=your_key_here
 * 3. Run: npx ts-node src/extract_gemini.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { createObjectCsvWriter } from 'csv-writer';
import puppeteer from 'puppeteer';
import { GoogleGenerativeAI } from '@google/generative-ai';

const CSV_PATH = path.join(__dirname, '..', 'output', 'bexar_documents.csv');
const OUTPUT_CSV_PATH = path.join(__dirname, '..', 'output', 'bexar_documents_updated.csv');

interface DocumentRecord {
    doc_id: string;
    recorded_date: string;
    instrument_date: string;
    borrower_owner_name: string;
    lender_name: string;
    loan_amount: string;
    property_address: string;
    city: string;
    zip: string;
    lat: string;
    lng: string;
    zone_id: string;
    doc_url: string;
}

function readCSV(filePath: string): DocumentRecord[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    return parse(content, { columns: true, skip_empty_lines: true });
}

// Rate limiting for free tier (15 requests per minute)
async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractWithGemini(
    genAI: GoogleGenerativeAI,
    imageBuffer: Buffer
): Promise<{ borrower: string; lender: string; loan_amount: string }> {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const prompt = `Analyze this foreclosure document image and extract:
1. BORROWER/GRANTOR: The person(s) who owes the debt (look for "Grantor:", "Borrower:", "Obligor:", or names after "executed by")
2. LENDER/MORTGAGEE: The bank or company that holds the loan (look for "Mortgagee:", "Lender:", "Current Mortgagee:", or bank names)
3. LOAN AMOUNT: The original loan/debt amount in dollars (look for "principal sum of $" or "original amount of $")

Respond ONLY in this exact JSON format, no other text:
{"borrower": "Name Here", "lender": "Bank Name Here", "loan_amount": "123456.00"}

If a field cannot be found, use empty string "". Do not include addresses, just names.`;

    try {
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: 'image/png',
                    data: imageBuffer.toString('base64')
                }
            }
        ]);

        const response = result.response.text();

        // Parse JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                borrower: parsed.borrower || '',
                lender: parsed.lender || '',
                loan_amount: parsed.loan_amount || ''
            };
        }
    } catch (error: any) {
        console.error(`  Gemini error: ${error.message}`);
    }

    return { borrower: '', lender: '', loan_amount: '' };
}

async function main() {
    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY environment variable not set!');
        console.log('\nTo get a FREE API key:');
        console.log('1. Go to https://aistudio.google.com/apikey');
        console.log('2. Click "Create API Key"');
        console.log('3. Run: export GEMINI_API_KEY=your_key_here');
        console.log('4. Then run this script again');
        process.exit(1);
    }

    console.log('🚀 Starting Gemini Vision extraction...');
    console.log('   Using FREE tier (15 requests/minute)');

    const genAI = new GoogleGenerativeAI(apiKey);

    // Read documents - use updated CSV if exists to preserve progress
    const inputPath = fs.existsSync(OUTPUT_CSV_PATH) ? OUTPUT_CSV_PATH : CSV_PATH;
    console.log(`📁 Reading from ${inputPath}`);

    const docs = readCSV(inputPath);

    // Only process documents missing borrower info
    const pendingDocs = docs.filter(d =>
        !d.borrower_owner_name ||
        d.borrower_owner_name.trim() === '' ||
        d.borrower_owner_name === 'None'
    );

    console.log(`📊 Total documents: ${docs.length}`);
    console.log(`🔍 Pending extraction: ${pendingDocs.length}`);

    if (pendingDocs.length === 0) {
        console.log('✅ All documents already processed!');
        return;
    }

    // Launch browser
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    await page.setViewport({ width: 1280, height: 1600, deviceScaleFactor: 2 });

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
                { id: 'loan_amount', title: 'loan_amount' },
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
        console.log(`💾 Saved progress`);
    };

    let requestCount = 0;
    const startTime = Date.now();

    for (const [index, doc] of pendingDocs.entries()) {
        console.log(`\n[${index + 1}/${pendingDocs.length}] Processing ${doc.doc_id}...`);

        try {
            // Navigate to document
            await page.goto(doc.doc_url, { waitUntil: 'networkidle2', timeout: 30000 });

            // Wait for document to render
            try {
                await page.waitForSelector('svg, canvas, img', { timeout: 10000 });
            } catch (e) { }
            await sleep(3000);

            // Take screenshot
            const buffer = await page.screenshot({ fullPage: true });

            // Rate limiting: 15 requests per minute = 1 request per 4 seconds
            requestCount++;
            if (requestCount > 1) {
                const elapsed = Date.now() - startTime;
                const expectedTime = requestCount * 4000; // 4 seconds per request
                if (elapsed < expectedTime) {
                    const waitTime = expectedTime - elapsed;
                    console.log(`   ⏳ Rate limiting... waiting ${Math.round(waitTime / 1000)}s`);
                    await sleep(waitTime);
                }
            }

            // Extract with Gemini
            const result = await extractWithGemini(genAI, buffer);

            // Update document
            doc.borrower_owner_name = result.borrower || doc.borrower_owner_name || '';
            doc.lender_name = result.lender || doc.lender_name || '';
            doc.loan_amount = result.loan_amount || doc.loan_amount || '';

            console.log(`   ✅ Borrower: ${doc.borrower_owner_name || 'None'}`);
            console.log(`      Lender: ${doc.lender_name || 'None'}`);
            console.log(`      Amount: ${doc.loan_amount || 'None'}`);

        } catch (error: any) {
            console.error(`   ❌ Error: ${error.message}`);
        }

        // Save every 5 documents
        if ((index + 1) % 5 === 0) {
            await saveProgress();
        }
    }

    // Final save
    await saveProgress();
    await browser.close();

    console.log('\n🎉 Extraction complete!');
    console.log(`   Run 'node dashboard/convert-data.js' to update dashboard`);
}

main().catch(console.error);
