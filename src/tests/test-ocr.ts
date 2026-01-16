// Test OCR - extracts text from document image using Tesseract.js

import puppeteer from 'puppeteer';
import { createWorker } from 'tesseract.js';

async function testOCR() {
    console.log('Testing OCR on document 288414897...');

    // 1. Get the image URL using Puppeteer
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,1024']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    // Set high-res viewport for better OCR
    await page.setViewport({ width: 1280, height: 1024, deviceScaleFactor: 2 });

    let imageBuffer: Buffer | null = null;

    try {
        console.log('Navigating to document page...');
        await page.goto('https://bexar.tx.publicsearch.us/doc/288414897', { waitUntil: 'networkidle2' });

        // Wait for the SVG image to load
        await page.waitForSelector('svg', { timeout: 20000 });

        // Slight delay to ensure rendering
        await new Promise(r => setTimeout(r, 2000));

        // Screenshot the SVG element directly (crops out UI)
        const element = await page.$('svg');
        if (element) {
            imageBuffer = await element.screenshot();
            console.log('Captured screenshot of SVG element');
        } else {
            console.error('SVG element not found');
            return;
        }

    } catch (error) {
        console.error('Failed to capture screenshot:', error);
        await browser.close();
        return;
    } finally {
        await browser.close();
    }

    if (!imageBuffer) {
        console.error('No image buffer captured!');
        return;
    }

    // 2. Run OCR using Tesseract.js
    console.log('Running OCR (this may take a moment)...');

    try {
        const worker = await createWorker();

        // Tesseract 5.x API
        // await worker.loadLanguage('eng');
        // await worker.initialize('eng');

        const ret = await worker.recognize(imageBuffer);
        const text = ret.data.text;

        console.log('\n--- OCR RESULT (Sample) ---');
        console.log(text.substring(0, 2000)); // Print first 2000 chars
        console.log('---------------------------\n');

        await worker.terminate();

        // Attempt parsing
        // Standard Texas Foreclosure Notice usually starts with:
        // "WHEREAS, on [Date], [Borrower] executed..."

        const borrowerRegex = /WHEREAS.*?\s+on\s+.*?,?\s+(.*?)\s+executed/i;
        const lenderRegex = /benefit\s+of\s+(.*?)\s+recorded/i;

        const borrowerMatch = text.replace(/\n/g, ' ').match(borrowerRegex);
        const lenderMatch = text.replace(/\n/g, ' ').match(lenderRegex);

        console.log('Extraction Analysis:');
        console.log(`- Borrower Candidate: "${borrowerMatch ? borrowerMatch[1].trim() : 'Not found'}"`);
        console.log(`- Lender Candidate: "${lenderMatch ? lenderMatch[1].trim() : 'Not found'}"`);


    } catch (error) {
        console.error('OCR failed:', error);
    }
}

testOCR();
