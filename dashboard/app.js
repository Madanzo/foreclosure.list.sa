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

// Initialize
initMap();
loadData();
