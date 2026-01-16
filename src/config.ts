// Configuration for Bexar County Document Scraper

export const config = {
    // Base URLs
    baseUrl: 'https://bexar.tx.publicsearch.us',
    searchUrl: 'https://bexar.tx.publicsearch.us/results',

    // Search parameters
    search: {
        department: 'FC', // Foreclosure
        dateRange: '20260101,20260131', // January 2026
        limit: 50,
        keywordSearch: false,
        searchOcrText: false,
        searchType: 'quickSearch'
    },

    // Rate limiting (milliseconds)
    delays: {
        betweenPages: 2000,      // Delay between pagination requests
        betweenDocuments: 1500,  // Delay between document detail requests
        afterError: 5000         // Delay after an error
    },

    // Geocoding (OpenStreetMap Nominatim)
    // Nominatim requires a valid User-Agent with contact info per their usage policy
    // https://operations.osmfoundation.org/policies/nominatim/
    geocoding: {
        baseUrl: 'https://nominatim.openstreetmap.org/search',
        userAgent: 'BexarCountyDocumentScraper/1.0 (bexar-scraper@example.com)',
        rateLimit: 1000 // 1 request per second (Nominatim policy)
    },

    // Clustering
    clustering: {
        radiusMiles: 1.5,
        radiusKm: 2.414 // 1.5 miles in km
    },

    // Output
    output: {
        dataFile: 'output/bexar_documents.csv',
        zonesFile: 'output/bexar_zones.csv',
        logFile: 'output/run_log.txt',
        errorsFile: 'output/errors.json'
    }
};

export type DocumentRecord = {
    doc_id: string;
    doc_url: string;
    doc_type: string;
    recorded_date: string;
    sale_date: string;
    property_address: string;
    remarks: string;
};

export type ExtractedDocument = DocumentRecord & {
    borrower_owner_name: string | null;
    lender_name: string | null;
    instrument_number: string | null;
    city: string | null;
    zip: string | null;
    lat: number | null;
    lng: number | null;
    zone_id: string | null;
    extraction_error: string | null;
};

export type Zone = {
    zone_id: string;
    count: number;
    centroid_lat: number;
    centroid_lng: number;
    sample_addresses: string[];
    google_maps_link: string;
};
