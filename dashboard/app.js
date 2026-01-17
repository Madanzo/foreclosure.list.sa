// Bexar County Foreclosures Dashboard

let documents = [];
let zones = [];
let map;
let markers = [];
let currentPage = 1;
const pageSize = 25;

// Zone colors
const zoneColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
    '#14b8a6', '#a855f7', '#22c55e', '#eab308', '#d946ef'
];

function getZoneColor(zoneId) {
    const index = zoneId.charCodeAt(zoneId.length - 1) % zoneColors.length;
    return zoneColors[index];
}

// Initialize map
function initMap() {
    map = L.map('map').setView([29.45, -98.5], 10);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);
}

// Load data
async function loadData() {
    try {
        // Load documents
        const docsResponse = await fetch('data/documents.json');
        documents = await docsResponse.json();

        // Load zones
        const zonesResponse = await fetch('data/zones.json');
        zones = await zonesResponse.json();

        // Update UI
        document.getElementById('totalDocs').textContent = documents.length;
        document.getElementById('geocodedCount').textContent = documents.filter(d => d.lat).length;
        document.getElementById('zoneCount').textContent = zones.length;

        populateZoneFilter();
        renderZones();
        renderMarkers();
        renderTable();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Populate zone filter dropdown
function populateZoneFilter() {
    const select = document.getElementById('zoneFilter');
    zones.forEach(zone => {
        const option = document.createElement('option');
        option.value = zone.zone_id;
        option.textContent = `${zone.zone_id} (${zone.count})`;
        select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
        filterByZone(e.target.value);
    });
}

// Render zone cards
function renderZones() {
    const container = document.getElementById('zonesList');
    container.innerHTML = '';

    zones.forEach(zone => {
        const card = document.createElement('div');
        card.className = 'zone-card';
        card.innerHTML = `
            <div class="zone-card-header">
                <span class="zone-id">${zone.zone_id}</span>
                <span class="zone-count">${zone.count} props</span>
            </div>
            <div class="zone-sample">${zone.sample_addresses[0] || ''}</div>
        `;

        card.addEventListener('click', () => {
            filterByZone(zone.zone_id);
            document.getElementById('zoneFilter').value = zone.zone_id;

            // Zoom to zone on map
            if (zone.centroid_lat && zone.centroid_lng) {
                map.setView([zone.centroid_lat, zone.centroid_lng], 13);
            }
        });

        container.appendChild(card);
    });
}

// Render map markers
function renderMarkers(filteredDocs = null) {
    // Clear existing markers
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    const docsToShow = filteredDocs || documents;

    docsToShow.forEach(doc => {
        if (doc.lat && doc.lng) {
            const color = getZoneColor(doc.zone_id || 'A');

            const marker = L.circleMarker([doc.lat, doc.lng], {
                radius: 6,
                fillColor: color,
                color: '#fff',
                weight: 1,
                opacity: 0.9,
                fillOpacity: 0.7
            });

            marker.bindPopup(`
                <div class="popup-content">
                    <h3>${doc.zone_id || 'Unknown'}</h3>
                    <p><strong>${doc.property_address}</strong></p>
                    <p>Sale Date: ${doc.sale_date || doc.instrument_date}</p>
                    <p>Doc #: ${doc.doc_id}</p>
                    <a href="${doc.doc_url}" target="_blank" style="color: #3b82f6;">View Document →</a>
                </div>
            `);

            marker.addTo(map);
            markers.push(marker);
        }
    });
}

// Filter by zone
function filterByZone(zoneId) {
    if (!zoneId) {
        renderMarkers();
        renderTable();
        return;
    }

    const filtered = documents.filter(d => d.zone_id === zoneId);
    renderMarkers(filtered);
    renderTable(filtered);
}

// Render data table
function renderTable(filteredDocs = null) {
    const tbody = document.getElementById('tableBody');
    const docsToShow = filteredDocs || documents;

    // Pagination
    const totalPages = Math.ceil(docsToShow.length / pageSize);
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageData = docsToShow.slice(start, end);

    tbody.innerHTML = '';

    pageData.forEach(doc => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${doc.doc_id}</td>
            <td>${doc.sale_date || doc.instrument_date || '-'}</td>
            <td>${doc.borrower_owner_name || '<span style="color:#666">Pending</span>'}</td>
            <td>${doc.lender_name || '-'}</td>
            <td>${doc.loan_amount ? '$' + doc.loan_amount : '-'}</td>
            <td>${doc.property_address || '-'}</td>
            <td>${doc.city || '-'}</td>
            <td>${doc.zip || '-'}</td>
            <td><span class="zone-badge" style="background: ${getZoneColor(doc.zone_id || 'A')}">${doc.zone_id || '-'}</span></td>
            <td>
                <a href="${doc.doc_url}" target="_blank" class="btn btn-primary">View</a>
                ${doc.lat ? `<a href="https://www.google.com/maps?q=${doc.lat},${doc.lng}" target="_blank" class="btn btn-secondary">Map</a>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderPagination(docsToShow.length, totalPages);
}

// Render pagination
function renderPagination(total, totalPages) {
    const container = document.getElementById('pagination');
    container.innerHTML = `
        <button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>← Prev</button>
        <span>Page ${currentPage} of ${totalPages} (${total} records)</span>
        <button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>
    `;
}

function goToPage(page) {
    currentPage = page;
    renderTable();
}

// Search functionality
document.getElementById('searchInput').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();

    if (!query) {
        renderTable();
        return;
    }

    const filtered = documents.filter(doc =>
        (doc.property_address && doc.property_address.toLowerCase().includes(query)) ||
        (doc.city && doc.city.toLowerCase().includes(query)) ||
        (doc.zip && doc.zip.includes(query)) ||
        (doc.zone_id && doc.zone_id.toLowerCase().includes(query))
    );

    currentPage = 1;
    renderTable(filtered);
    renderMarkers(filtered);
});

// Column Filters
function applyColumnFilters() {
    const filters = {
        docId: document.getElementById('filterDocId').value.toLowerCase(),
        date: document.getElementById('filterDate').value.toLowerCase(),
        borrower: document.getElementById('filterBorrower').value.toLowerCase(),
        lender: document.getElementById('filterLender').value.toLowerCase(),
        amount: document.getElementById('filterAmount').value,
        address: document.getElementById('filterAddress').value.toLowerCase(),
        city: document.getElementById('filterCity').value.toLowerCase(),
        zip: document.getElementById('filterZip').value.toLowerCase(),
        zone: document.getElementById('filterZone').value
    };

    let filtered = documents.filter(doc => {
        // Doc ID filter
        if (filters.docId && !doc.doc_id.toLowerCase().includes(filters.docId)) return false;

        // Date filter
        const docDate = doc.sale_date || doc.instrument_date || '';
        if (filters.date && !docDate.toLowerCase().includes(filters.date)) return false;

        // Borrower filter
        const borrower = doc.borrower_owner_name || '';
        if (filters.borrower && !borrower.toLowerCase().includes(filters.borrower)) return false;

        // Lender filter
        const lender = doc.lender_name || '';
        if (filters.lender && !lender.toLowerCase().includes(filters.lender)) return false;

        // Amount filter (supports min-max range like "100000-200000")
        if (filters.amount) {
            const docAmount = parseFloat((doc.loan_amount || '0').replace(/[^0-9.]/g, ''));
            if (filters.amount.includes('-')) {
                const [min, max] = filters.amount.split('-').map(v => parseFloat(v) || 0);
                if (docAmount < min || (max && docAmount > max)) return false;
            } else {
                const minAmount = parseFloat(filters.amount);
                if (!isNaN(minAmount) && docAmount < minAmount) return false;
            }
        }

        // Address filter
        const address = doc.property_address || '';
        if (filters.address && !address.toLowerCase().includes(filters.address)) return false;

        // City filter
        const city = doc.city || '';
        if (filters.city && !city.toLowerCase().includes(filters.city)) return false;

        // ZIP filter
        const zip = doc.zip || '';
        if (filters.zip && !zip.includes(filters.zip)) return false;

        // Zone filter
        if (filters.zone && doc.zone_id !== filters.zone) return false;

        return true;
    });

    currentPage = 1;
    renderTable(filtered);
    renderMarkers(filtered);
}

// Add event listeners to all filter inputs
function setupFilterListeners() {
    const filterIds = ['filterDocId', 'filterDate', 'filterBorrower', 'filterLender',
        'filterAmount', 'filterAddress', 'filterCity', 'filterZip', 'filterZone'];

    filterIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', applyColumnFilters);
            el.addEventListener('change', applyColumnFilters);
        }
    });

    // Populate zone filter dropdown
    const zoneSelect = document.getElementById('filterZone');
    if (zoneSelect && zones.length) {
        zones.forEach(zone => {
            const option = document.createElement('option');
            option.value = zone.zone_id;
            option.textContent = zone.zone_id;
            zoneSelect.appendChild(option);
        });
    }

    // Clear filters button
    document.getElementById('clearFilters')?.addEventListener('click', () => {
        filterIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        currentPage = 1;
        renderTable();
        renderMarkers();
    });
}

// Initialize
initMap();
loadData().then(() => {
    setupFilterListeners();
});
