// Simplified main script - runs full pipeline using search result data only
// Skips PDF extraction since property addresses are already in search results

import { Scraper } from './scraper';
import { normalizeAddress } from './normalizer';
import { geocodeAddress } from './geocoder';
import { clusterDocuments, calculateZoneSummaries } from './zoning';
import { exportDocuments, exportZones, writeRunLog, RunStats } from './exporter';
import { ExtractedDocument } from './config';

async function main() {
    const startTime = new Date();
    console.log('='.repeat(60));
    console.log('BEXAR COUNTY DOCUMENT SCRAPER');
    console.log(`Started: ${startTime.toISOString()}`);
    console.log('='.repeat(60));

    // Phase 1: Scrape all search results
    console.log('\n📋 PHASE 1: Scraping all search results...');
    const scraper = new Scraper();

    try {
        await scraper.init();
        const rawRecords = await scraper.scrapeAllPages();
        await scraper.close();

        console.log(`✅ Scraped ${rawRecords.length} document records`);

        // Phase 2: Build documents from search data (skip PDF extraction)
        console.log('\n📄 PHASE 2: Building documents from search data...');
        let documents: ExtractedDocument[] = rawRecords.map(r => {
            // Parse city/zip from address
            const parts = r.property_address.split(',').map(p => p.trim());
            let city = parts.length >= 2 ? parts[1] : null;
            const zipMatch = r.property_address.match(/\b(\d{5})\b/);
            const zip = zipMatch ? zipMatch[1] : null;

            return {
                ...r,
                borrower_owner_name: null, // Would require PDF extraction
                lender_name: null,
                instrument_number: r.doc_id,
                city,
                zip,
                lat: null,
                lng: null,
                zone_id: null,
                extraction_error: null
            };
        });
        console.log(`✅ Built ${documents.length} document records`);

        // Phase 3: Normalize addresses
        console.log('\n🔧 PHASE 3: Normalizing addresses...');
        documents = documents.map(doc => ({
            ...doc,
            property_address: normalizeAddress(doc.property_address)
        }));
        console.log('✅ Normalization complete');

        // Phase 4: Geocode addresses
        console.log('\n🌍 PHASE 4: Geocoding addresses...');
        let geocodedCount = 0;
        let geocodeFailures = 0;

        for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];

            if (doc.property_address) {
                const result = await geocodeAddress(doc.property_address);

                if (result) {
                    doc.lat = result.lat;
                    doc.lng = result.lng;
                    geocodedCount++;
                } else {
                    geocodeFailures++;
                }
            }

            if ((i + 1) % 25 === 0 || i === documents.length - 1) {
                console.log(`  Progress: ${i + 1}/${documents.length} (Geocoded: ${geocodedCount}, Failed: ${geocodeFailures})`);
            }
        }
        console.log(`✅ Geocoding complete: ${geocodedCount} success, ${geocodeFailures} failures`);

        // Phase 5: Cluster into zones
        console.log('\n🗺️ PHASE 5: Clustering into zones...');
        documents = clusterDocuments(documents);
        const zones = calculateZoneSummaries(documents);
        console.log(`✅ Created ${zones.length} zones`);

        // Phase 6: Export results
        console.log('\n💾 PHASE 6: Exporting results...');
        await exportDocuments(documents);
        await exportZones(zones);

        // Write run log
        const endTime = new Date();
        const stats: RunStats = {
            totalDocuments: documents.length,
            successfulExtractions: documents.filter(d => !d.extraction_error).length,
            extractionErrors: 0,
            geocodedAddresses: geocodedCount,
            geocodingFailures: geocodeFailures,
            totalZones: zones.length,
            startTime,
            endTime
        };
        writeRunLog(stats, []);

        console.log('\n' + '='.repeat(60));
        console.log('✅ SCRAPING COMPLETE');
        console.log(`Duration: ${((endTime.getTime() - startTime.getTime()) / 1000 / 60).toFixed(2)} minutes`);
        console.log(`Documents: ${documents.length}`);
        console.log(`Geocoded: ${geocodedCount} (${((geocodedCount / documents.length) * 100).toFixed(1)}%)`);
        console.log(`Zones: ${zones.length}`);
        console.log('='.repeat(60));
        console.log(`\nOutput files:`);
        console.log(`  Documents: output/bexar_documents.csv`);
        console.log(`  Zones: output/bexar_zones.csv`);
        console.log(`  Log: output/run_log.txt`);

    } catch (error) {
        console.error('Fatal error:', error);
        await scraper.close();
        process.exit(1);
    }
}

main();
