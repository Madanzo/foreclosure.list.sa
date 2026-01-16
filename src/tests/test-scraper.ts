// Test scraper - verify we can scrape search results page

import { Scraper } from '../scraper';

async function testScraper() {
    console.log('Testing scraper on first page only...\n');

    const scraper = new Scraper();

    try {
        await scraper.init();

        // Only scrape the first page (offset=0)
        const records = await scraper.scrapeSearchPage(0);

        console.log(`\n✅ Successfully scraped ${records.length} records\n`);

        // Show first 5 records as sample
        console.log('Sample records:');
        console.log('-'.repeat(80));

        records.slice(0, 5).forEach((record, i) => {
            console.log(`\n${i + 1}. Doc ID: ${record.doc_id}`);
            console.log(`   Type: ${record.doc_type}`);
            console.log(`   Recorded: ${record.recorded_date}`);
            console.log(`   Sale Date: ${record.sale_date}`);
            console.log(`   Address: ${record.property_address}`);
            console.log(`   URL: ${record.doc_url}`);
        });

        console.log('\n' + '-'.repeat(80));
        console.log('✅ Scraper test PASSED');

    } catch (error) {
        console.error('❌ Scraper test FAILED:', error);
    } finally {
        await scraper.close();
    }
}

testScraper();
