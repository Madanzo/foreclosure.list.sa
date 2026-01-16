// Scraper module - extracts document data from search results pages

import puppeteer, { Browser, Page } from 'puppeteer';
import { config, DocumentRecord } from './config';

export class Scraper {
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

    buildSearchUrl(offset: number): string {
        const params = new URLSearchParams({
            department: config.search.department,
            instrumentDateRange: config.search.dateRange,
            keywordSearch: String(config.search.keywordSearch),
            limit: String(config.search.limit),
            offset: String(offset),
            searchOcrText: String(config.search.searchOcrText),
            searchType: config.search.searchType
        });
        return `${config.searchUrl}?${params.toString()}`;
    }

    async scrapeSearchPage(offset: number): Promise<DocumentRecord[]> {
        if (!this.page) throw new Error('Browser not initialized');

        const url = this.buildSearchUrl(offset);
        console.log(`Scraping: ${url}`);

        await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for results table to load
        await this.page.waitForSelector('tbody tr', { timeout: 15000 }).catch(() => null);

        // Additional wait for dynamic content
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Extract data from table rows
        const records = await this.page.evaluate((baseUrl: string) => {
            const rows = document.querySelectorAll('tbody tr');
            const results: Array<{
                doc_id: string;
                doc_url: string;
                doc_type: string;
                recorded_date: string;
                sale_date: string;
                property_address: string;
                remarks: string;
            }> = [];

            rows.forEach((row) => {
                // Get doc ID from checkbox element
                const checkbox = row.querySelector('td.col-0 input[type="checkbox"]');
                const checkboxId = checkbox?.getAttribute('id') || '';
                const docId = checkboxId.replace('table-checkbox-', '');

                // Get text from each column (col-3 through col-8)
                const getColText = (colNum: number): string => {
                    const cell = row.querySelector(`td.col-${colNum} span`);
                    return cell?.textContent?.trim() || '';
                };

                if (docId) {
                    results.push({
                        doc_id: docId,
                        doc_url: `${baseUrl}/doc/${docId}`,
                        doc_type: getColText(3),       // Doc Type
                        recorded_date: getColText(4),   // Recorded Date
                        sale_date: getColText(5),       // Sale Date
                        property_address: getColText(8), // Property Address
                        remarks: getColText(7)          // Remarks
                    });
                }
            });

            return results;
        }, config.baseUrl);

        return records;
    }

    async scrapeAllPages(): Promise<DocumentRecord[]> {
        const allRecords: DocumentRecord[] = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
            const records = await this.scrapeSearchPage(offset);

            if (records.length === 0) {
                hasMore = false;
            } else {
                allRecords.push(...records);
                console.log(`Collected ${allRecords.length} documents so far...`);

                if (records.length < config.search.limit) {
                    hasMore = false;
                } else {
                    offset += config.search.limit;
                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, config.delays.betweenPages));
                }
            }
        }

        return allRecords;
    }
}

// Export singleton instance
export const scraper = new Scraper();
