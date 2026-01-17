/**
 * Local AI extraction using Ollama + LLaVA
 * Completely FREE and PRIVATE
 * 
 * Setup:
 * 1. Install Ollama: https://ollama.com/download
 * 2. Run: ollama serve
 * 3. Run: ollama pull llava:7b
 * 4. Run: npx ts-node src/extract_ollama.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { createObjectCsvWriter } from 'csv-writer';
import puppeteer from 'puppeteer';
import axios from 'axios';

const CSV_PATH = path.join(__dirname, '..', 'output', 'bexar_documents_updated.csv');
// Fallback to original if updated doesn't exist
const INPUT_CSV_PATH = fs.existsSync(CSV_PATH) ? CSV_PATH : path.join(__dirname, '..', 'output', 'bexar_documents.csv');
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

import sharp from 'sharp';

async function extractWithOllama(
    imageBuffer: Buffer
): Promise<{ borrower: string; lender: string; loan_amount: string }> {
    // 1. Resize image to speed up processing (max width 720px)
    const processedImage = await sharp(imageBuffer)
        .resize({ width: 720, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

    const prompt = `Extract these 3 fields from the document image in JSON format:
1. "borrower": The borrower/grantor name.
2. "lender": The lender/mortgagee name.
3. "loan_amount": The loan amount (number only).

If not found, use empty string. Respond ONLY in valid JSON.`;

    try {
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: "moondream", // Much faster model
            prompt: prompt,
            images: [processedImage.toString('base64')],
            stream: false,
            format: "json"
        }, { timeout: 300000 }); // 300s (5 min) timeout per doc

        const jsonStr = response.data.response;
        // Clean up markdown code blocks if any
        const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
        let result;
        try {
            result = JSON.parse(cleanJson);
        } catch (e) {
            // Fallback for moondream's occasional non-JSON chatter
            console.log('   Warning: AI output not perfect JSON, trying regex fix...');
            const borrower = (cleanJson.match(/"borrower":\s*"([^"]+)"/i) || [])[1] || '';
            const lender = (cleanJson.match(/"lender":\s*"([^"]+)"/i) || [])[1] || '';
            const amount = (cleanJson.match(/"loan_amount":\s*"([^"]+)"/i) || [])[1] || '';
            result = { borrower, lender, loan_amount: amount };
        }

        return {
            borrower: result.borrower || '',
            lender: result.lender || '',
            loan_amount: result.loan_amount || ''
        };

    } catch (error: any) {
        console.error(`  Ollama error: ${error.message}`);
        // If connection refused, warn user
        if (error.code === 'ECONNREFUSED') {
            console.error('  ⚠️  Is Ollama running? Run "ollama serve" in a separate terminal.');
        }
    }

    return { borrower: '', lender: '', loan_amount: '' };
}

async function main() {
    console.log('🚀 Starting Local AI extraction (Ollama - Moondream)...');

    // Check if Ollama is accessible
    try {
        await axios.get('http://localhost:11434/');
        console.log('✅ Ollama server is running');
    } catch (e) {
        console.error('❌ Ollama server NOT reachable at http://localhost:11434');
        console.log('   Please run "ollama serve" first!');
        process.exit(1);
    }

    console.log(`📁 Reading from ${INPUT_CSV_PATH}`);
    const docs = readCSV(INPUT_CSV_PATH);

    // Filter for missing borrower info
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
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    // Use a standard desktop viewport
    await page.setViewport({ width: 1200, height: 1600 });

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

    // Process loop
    for (const [index, doc] of pendingDocs.entries()) {
        console.log(`\n[${index + 1}/${pendingDocs.length}] Processing ${doc.doc_id}...`);

        try {
            await page.goto(doc.doc_url, { waitUntil: 'networkidle0', timeout: 30000 });

            // Wait for image/canvas to load
            await new Promise(r => setTimeout(r, 2000));

            const buffer = await page.screenshot({ fullPage: true });

            console.log('   🧠 Analyzing with LLaVA...');
            const startTime = Date.now();

            const result = await extractWithOllama(buffer);

            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`   ⏱️  Analysis took ${duration}s`);

            if (result.borrower || result.lender) {
                // Update doc
                doc.borrower_owner_name = result.borrower || doc.borrower_owner_name || '';
                doc.lender_name = result.lender || doc.lender_name || '';
                doc.loan_amount = result.loan_amount || doc.loan_amount || ''; // Clean up non-digits later

                console.log(`   ✅ Extracted:`);
                console.log(`      Borrower: ${doc.borrower_owner_name}`);
                console.log(`      Lender:   ${doc.lender_name}`);
                console.log(`      Amount:   ${doc.loan_amount}`);
            } else {
                console.log('   ⚠️  No data found by AI');
            }

        } catch (error: any) {
            console.error(`   ❌ Error: ${error.message}`);
        }

        // Save every 2 docs (since local inference is slower, save more often)
        if ((index + 1) % 2 === 0) await saveProgress();
    }

    await saveProgress();
    await browser.close();
    console.log('\n🎉 Done! Run data conversion script to update dashboard.');
}

main().catch(console.error);
