// Exporter module - generates CSV output files

import { createObjectCsvWriter } from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';
import { config, ExtractedDocument, Zone } from './config';

export async function exportDocuments(documents: ExtractedDocument[]): Promise<void> {
    // Ensure output directory exists
    const outputDir = path.dirname(config.output.dataFile);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const csvWriter = createObjectCsvWriter({
        path: config.output.dataFile,
        header: [
            { id: 'doc_id', title: 'doc_id' },
            { id: 'recorded_date', title: 'recorded_date' },
            { id: 'sale_date', title: 'instrument_date' },
            { id: 'borrower_owner_name', title: 'borrower_owner_name' },
            { id: 'lender_name', title: 'lender_name' },
            { id: 'property_address', title: 'property_address' },
            { id: 'city', title: 'city' },
            { id: 'zip', title: 'zip' },
            { id: 'lat', title: 'lat' },
            { id: 'lng', title: 'lng' },
            { id: 'zone_id', title: 'zone_id' },
            { id: 'doc_url', title: 'doc_url' }
        ]
    });

    await csvWriter.writeRecords(documents);
    console.log(`Exported ${documents.length} documents to ${config.output.dataFile}`);
}

export async function exportZones(zones: Zone[]): Promise<void> {
    const outputDir = path.dirname(config.output.zonesFile);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const csvWriter = createObjectCsvWriter({
        path: config.output.zonesFile,
        header: [
            { id: 'zone_id', title: 'zone_id' },
            { id: 'count', title: 'count' },
            { id: 'centroid_lat', title: 'centroid_lat' },
            { id: 'centroid_lng', title: 'centroid_lng' },
            { id: 'sample_addresses', title: 'sample_addresses' },
            { id: 'google_maps_link', title: 'google_maps_link' }
        ]
    });

    const records = zones.map(z => ({
        ...z,
        sample_addresses: z.sample_addresses.join(' | ')
    }));

    await csvWriter.writeRecords(records);
    console.log(`Exported ${zones.length} zones to ${config.output.zonesFile}`);
}

export interface RunStats {
    totalDocuments: number;
    successfulExtractions: number;
    extractionErrors: number;
    geocodedAddresses: number;
    geocodingFailures: number;
    totalZones: number;
    startTime: Date;
    endTime: Date;
}

export function writeRunLog(stats: RunStats, errors: Array<{ doc_id: string; error: string }>): void {
    const outputDir = path.dirname(config.output.logFile);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const duration = (stats.endTime.getTime() - stats.startTime.getTime()) / 1000 / 60;

    const logContent = `
BEXAR COUNTY DOCUMENT SCRAPER - RUN LOG
========================================
Date: ${stats.endTime.toISOString()}
Duration: ${duration.toFixed(2)} minutes

SUMMARY
-------
Total Documents Scraped: ${stats.totalDocuments}
Successful Extractions: ${stats.successfulExtractions}
Extraction Errors: ${stats.extractionErrors}
Geocoded Addresses: ${stats.geocodedAddresses}
Geocoding Failures: ${stats.geocodingFailures}
Total Zones Created: ${stats.totalZones}

SUCCESS RATE: ${((stats.successfulExtractions / stats.totalDocuments) * 100).toFixed(1)}%
GEOCODING RATE: ${((stats.geocodedAddresses / stats.totalDocuments) * 100).toFixed(1)}%

OUTPUT FILES
------------
Documents: ${config.output.dataFile}
Zones: ${config.output.zonesFile}
Errors: ${config.output.errorsFile}
`;

    fs.writeFileSync(config.output.logFile, logContent);
    console.log(`Run log written to ${config.output.logFile}`);

    // Write errors JSON
    if (errors.length > 0) {
        fs.writeFileSync(config.output.errorsFile, JSON.stringify(errors, null, 2));
        console.log(`${errors.length} errors logged to ${config.output.errorsFile}`);
    }
}
