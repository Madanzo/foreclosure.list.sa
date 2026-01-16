// Document extractor - extracts party information from document detail pages

import puppeteer, { Browser, Page } from 'puppeteer';
import { config, DocumentRecord, ExtractedDocument } from './config';

export class Extractor {
    private browser: Browser | null = null;
    private page: Page | null = null;

    async init(): Promise<void> {
        this.browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.page = await this.browser.newPage();
        await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    }

    async close(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
        }
    }

    async extractDocument(record: DocumentRecord): Promise<ExtractedDocument> {
        if (!this.page) throw new Error('Browser not initialized');

        const result: ExtractedDocument = {
            ...record,
            borrower_owner_name: null,
            lender_name: null,
            instrument_number: null,
            city: null,
            zip: null,
            lat: null,
            lng: null,
            zone_id: null,
            extraction_error: null
        };

        try {
            await this.page.goto(record.doc_url, { waitUntil: 'networkidle2', timeout: 30000 });

            // Wait for page to load
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Extract metadata from the page
            const metadata = await this.page.evaluate(() => {
                const getText = (selector: string): string | null => {
                    const el = document.querySelector(selector);
                    return el?.textContent?.trim() || null;
                };

                // Try to find party information in the metadata panel
                const partyElements = document.querySelectorAll('[class*="party"], [class*="Party"]');
                const parties: string[] = [];
                partyElements.forEach(el => {
                    const text = el.textContent?.trim();
                    if (text && text !== 'No parties found') {
                        parties.push(text);
                    }
                });

                // Get instrument/document number
                const docNumEl = document.querySelector('[class*="document-number"], [class*="instrumentNumber"]');
                const instrumentNumber = docNumEl?.textContent?.trim() || null;

                return {
                    parties,
                    instrumentNumber
                };
            });

            result.instrument_number = metadata.instrumentNumber || record.doc_id;

            // Try to extract text from PDF viewer
            const pdfText = await this.extractPdfText();

            if (pdfText) {
                // Parse borrower/owner names
                const borrowers = this.parseBorrowers(pdfText);
                if (borrowers.length > 0) {
                    result.borrower_owner_name = borrowers.join('; ');
                }

                // Parse lender names
                const lenders = this.parseLenders(pdfText);
                if (lenders.length > 0) {
                    result.lender_name = lenders.join('; ');
                }
            }

            // Parse city and zip from address
            const addressParts = this.parseAddress(record.property_address);
            result.city = addressParts.city;
            result.zip = addressParts.zip;

        } catch (error) {
            result.extraction_error = error instanceof Error ? error.message : String(error);
        }

        return result;
    }

    private async extractPdfText(): Promise<string | null> {
        if (!this.page) return null;

        try {
            // Try to get text from the PDF viewer canvas or text layer
            const text = await this.page.evaluate(() => {
                // Look for text layer in PDF.js viewer
                const textLayers = document.querySelectorAll('.textLayer span, .pdf-text, [class*="pdf"] span');
                let allText = '';
                textLayers.forEach(el => {
                    allText += ' ' + (el.textContent || '');
                });

                // If no text layer, try to get from any visible document content
                if (!allText.trim()) {
                    const contentAreas = document.querySelectorAll('[class*="document"], [class*="content"], [class*="viewer"]');
                    contentAreas.forEach(el => {
                        allText += ' ' + (el.textContent || '');
                    });
                }

                return allText.trim() || null;
            });

            return text;
        } catch {
            return null;
        }
    }

    private parseBorrowers(text: string): string[] {
        const borrowers: string[] = [];
        const patterns = [
            /(?:Grantor|Mortgagor|Borrower|Owner|Trustor)[\s:]*([A-Z][A-Za-z\s,\.]+?)(?=\n|Grantee|Mortgagee|Lender|Beneficiary|$)/gi,
            /([A-Z][A-Z\s,\.]+?)\s*,?\s*(?:as\s+)?(?:Grantor|Mortgagor|Borrower|Owner)/gi
        ];

        for (const pattern of patterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                const name = match[1]?.trim();
                if (name && name.length > 2 && name.length < 100) {
                    borrowers.push(this.cleanName(name));
                }
            }
        }

        return [...new Set(borrowers)]; // Remove duplicates
    }

    private parseLenders(text: string): string[] {
        const lenders: string[] = [];
        const patterns = [
            /(?:Grantee|Mortgagee|Lender|Beneficiary|Servicer)[\s:]*([A-Z][A-Za-z\s,\.]+?)(?=\n|Grantor|Mortgagor|Borrower|Address|$)/gi,
            /([A-Z][A-Za-z\s,\.]+?(?:N\.?A\.?|LLC|Inc\.?|Bank|Mortgage|Services?))\s*,?\s*(?:as\s+)?(?:Grantee|Mortgagee|Lender|Beneficiary)/gi
        ];

        for (const pattern of patterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                const name = match[1]?.trim();
                if (name && name.length > 2 && name.length < 150) {
                    lenders.push(this.cleanName(name));
                }
            }
        }

        return [...new Set(lenders)]; // Remove duplicates
    }

    private cleanName(name: string): string {
        return name
            .replace(/\s+/g, ' ')
            .replace(/,\s*$/, '')
            .trim();
    }

    private parseAddress(address: string): { city: string | null; zip: string | null } {
        // Parse: "711 S BROWNLEAF ST, SAN ANTONIO, TEXAS, 78227"
        const parts = address.split(',').map(p => p.trim());

        let city: string | null = null;
        let zip: string | null = null;

        // Look for ZIP code (5 digits or 5+4)
        const zipMatch = address.match(/\b(\d{5}(?:-\d{4})?)\b/);
        if (zipMatch) {
            zip = zipMatch[1];
        }

        // City is usually the second-to-last or third-to-last part before state/zip
        if (parts.length >= 3) {
            // Check if second part is city (before TEXAS/TX)
            const stateIndex = parts.findIndex(p => /^(TEXAS|TX)$/i.test(p));
            if (stateIndex > 1) {
                city = parts[stateIndex - 1];
            } else if (parts.length >= 2) {
                city = parts[1];
            }
        }

        return { city, zip };
    }

    async extractAllDocuments(
        records: DocumentRecord[],
        progressCallback?: (current: number, total: number) => void
    ): Promise<ExtractedDocument[]> {
        const results: ExtractedDocument[] = [];

        for (let i = 0; i < records.length; i++) {
            const record = records[i];

            if (progressCallback) {
                progressCallback(i + 1, records.length);
            }

            const extracted = await this.extractDocument(record);
            results.push(extracted);

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, config.delays.betweenDocuments));
        }

        return results;
    }
}

export const extractor = new Extractor();
