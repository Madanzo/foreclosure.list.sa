// Convert CSV data to JSON for dashboard
const fs = require('fs');
const path = require('path');

function parseCSV(content) {
    const lines = content.trim().split('\n');
    const headers = parseCSVLine(lines[0]);

    return lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const obj = {};
        headers.forEach((h, i) => {
            obj[h] = values[i] || null;
        });
        return obj;
    });
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());

    return result;
}

// Read documents CSV (prefer updated version)
const updatedPath = path.join(__dirname, '../output/bexar_documents_updated.csv');
const originalPath = path.join(__dirname, '../output/bexar_documents.csv');
const docsPath = fs.existsSync(updatedPath) ? updatedPath : originalPath;

const docsContent = fs.readFileSync(docsPath, 'utf-8');
const documents = parseCSV(docsContent);

// Read zones CSV
const zonesPath = path.join(__dirname, '../output/bexar_zones.csv');
const zonesContent = fs.readFileSync(zonesPath, 'utf-8');
const zones = parseCSV(zonesContent).map(z => ({
    ...z,
    count: parseInt(z.count) || 0,
    centroid_lat: parseFloat(z.centroid_lat) || null,
    centroid_lng: parseFloat(z.centroid_lng) || null,
    sample_addresses: z.sample_addresses ? z.sample_addresses.split(' | ') : []
}));

// Create data directory
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Write JSON files
fs.writeFileSync(
    path.join(dataDir, 'documents.json'),
    JSON.stringify(documents, null, 2)
);

fs.writeFileSync(
    path.join(dataDir, 'zones.json'),
    JSON.stringify(zones, null, 2)
);

console.log(`✅ Converted ${documents.length} documents and ${zones.length} zones to JSON`);
console.log(`   Output: dashboard/data/documents.json`);
console.log(`   Output: dashboard/data/zones.json`);
