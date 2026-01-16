// End-to-end test - run full pipeline on first 10 documents

import { Scraper } from '../scraper';
import { Extractor } from '../extractor';
import { normalizeAddress, normalizeOrgName } from '../normalizer';
import { geocodeAddress } from '../geocoder';
import { clusterDocuments, calculateZoneSummaries } from '../zoning';
import { config, ExtractedDocument } from '../config';

async function testE2E() {
    console.log('='.repeat(60));
    console.log('END-TO-END SMOKE TEST (10 documents)');
    console.log('='.repeat(60));

    const startTime = Date.now();

    // Phase 1: Scrape first page and take only 10 docs
    console.log('\n📋 Phase 1: Scraping...');
    const scraper = new Scraper();
    await scraper.init();

    let rawRecords = await scraper.scrapeSearchPage(0);
    await scraper.close();

    rawRecords = rawRecords.slice(0, 10); // Limit to 10 for testing
    console.log(`✅ Got ${rawRecords.length} records`);

    // Phase 2: Extract document details (skip for speed - we have addresses from search)
    console.log('\n📄 Phase 2: Building documents from search data...');
    let documents: ExtractedDocument[] = rawRecords.map(r => ({
        ...r,
        borrower_owner_name: null, // Would come from PDF extraction
        lender_name: null,
        instrument_number: r.doc_id,
        city: null,
        zip: null,
        lat: null,
        lng: null,
        zone_id: null,
        extraction_error: null
    }));

    // Parse city/zip from address
    documents = documents.map(doc => {
        const parts = doc.property_address.split(',').map(p => p.trim());
        let city = parts.length >= 2 ? parts[1] : null;
        const zipMatch = doc.property_address.match(/\b(\d{5})\b/);
        const zip = zipMatch ? zipMatch[1] : null;
        return { ...doc, city, zip };
    });
    console.log('✅ Parsed address components');

    // Phase 3: Normalize
    console.log('\n🔧 Phase 3: Normalizing...');
    documents = documents.map(doc => ({
        ...doc,
        property_address: normalizeAddress(doc.property_address)
    }));
    console.log('✅ Normalized addresses');

    // Phase 4: Geocode (just first 5 to save time)
    console.log('\n🌍 Phase 4: Geocoding first 5 addresses...');
    for (let i = 0; i < Math.min(5, documents.length); i++) {
        const doc = documents[i];
        console.log(`  Geocoding: ${doc.property_address}`);
        const result = await geocodeAddress(doc.property_address);
        if (result) {
            doc.lat = result.lat;
            doc.lng = result.lng;
            console.log(`    ✅ ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}`);
        } else {
            console.log(`    ❌ Failed`);
        }
    }

    // Phase 5: Cluster
    console.log('\n🗺️ Phase 5: Clustering...');
    documents = clusterDocuments(documents);
    const zones = calculateZoneSummaries(documents);
    console.log(`✅ Created ${zones.length} zones`);

    // Results summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log('RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`Duration: ${duration}s`);
    console.log(`Documents: ${documents.length}`);
    console.log(`Geocoded: ${documents.filter(d => d.lat !== null).length}`);
    console.log(`Zones: ${zones.length}`);

    console.log('\nSample Documents:');
    documents.slice(0, 3).forEach((doc, i) => {
        console.log(`\n${i + 1}. ${doc.property_address}`);
        console.log(`   City: ${doc.city}, ZIP: ${doc.zip}`);
        console.log(`   Lat/Lng: ${doc.lat?.toFixed(4) || 'N/A'}, ${doc.lng?.toFixed(4) || 'N/A'}`);
        console.log(`   Zone: ${doc.zone_id || 'N/A'}`);
    });

    console.log('\nZones:');
    zones.forEach(z => {
        console.log(`  ${z.zone_id}: ${z.count} properties`);
    });

    console.log('\n✅ END-TO-END TEST PASSED');
}

testE2E().catch(err => {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
});
