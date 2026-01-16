
import * as fs from 'fs';
import * as puppeteer from 'puppeteer-core';
import { createWorker } from 'tesseract.js';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CSV_PATH = 'output/bexar_documents_updated.csv';

interface DocumentRecord {
    doc_id: string;
    doc_url: string;
    borrower_owner_name: string;
    lender_name: string;
    loan_amount: string;
}

function readCSV(filePath: string): DocumentRecord[] {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',');

    return lines.slice(1).map(line => {
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
            else current += char;
        }
        values.push(current.trim());
        const obj: any = {};
        headers.forEach((h, i) => obj[h.trim()] = values[i]?.replace(/^"|"$/g, '') || '');
        return obj as DocumentRecord;
    });
}

async function main() {
    // Lakesha (288414902), Kathleen (288493503), Carlos (288579468)
    // Target Bill J. Martinez doc
    const targetIds = ['289414408'];
    console.log(`Analyzing target docs: ${targetIds.join(', ')}`);

    const docs = readCSV(CSV_PATH);
    const targets = docs.filter(d => targetIds.includes(d.doc_id));

    if (targets.length === 0) {
        console.log('No targets found in CSV.');
        return;
    }

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const worker = await createWorker();

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 1600, deviceScaleFactor: 2 });
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

        for (const doc of targets) {
            console.log(`\n\n=== Processing ${doc.doc_id} ===`);
            console.log(`URL: ${doc.doc_url}`);

            try {
                await page.goto(doc.doc_url, { waitUntil: 'networkidle2' });
                try {
                    await page.waitForSelector('svg, canvas, img', { timeout: 15000 });
                } catch (e) { }

                await new Promise(r => setTimeout(r, 4000));

                const buffer = await page.screenshot({ fullPage: true });
                const ret = await worker.recognize(buffer);

                const rawText = ret.data.text;
                const cleanText = rawText.replace(/\n/g, ' ').replace(/\s+/g, ' ');

                console.log('--- RAW TEXT START ---');
                console.log(cleanText);
                console.log('--- RAW TEXT END ---');

            } catch (err) {
                console.error('Error:', err);
            }
        }
    } finally {
        await worker.terminate();
        await browser.close();
    }
}

main();
