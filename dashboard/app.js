// Bexar County Foreclosures Dashboard

let documents = [];
let currentDocs = [];
let zones = [];
let map;
let markerMap = new Map();
let allMarkers = [];  // Track all markers for proper cleanup (handles duplicate doc_ids)
let statusMap = {};
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

// Get marker style based on status
function getMarkerStyle(doc) {
    const status = statusMap[doc.doc_id];
    const zoneColor = getZoneColor(doc.zone_id || 'A');

    // Default style (Not Visited/Unknown)
    let style = {
        radius: 6,
        fillColor: zoneColor,
        color: '#fff',
        weight: 1,
        opacity: 0.9,
        fillOpacity: 0.7
    };

    if (status === 'Visited') {
        style.color = '#10b981'; // Green
        style.weight = 3;
        style.opacity = 1;
    } else if (status === 'Super Good') {
        style.color = '#8b5cf6'; // Purple
        style.weight = 4;
        style.opacity = 1;
        style.fillOpacity = 0.9;
    } else if (status === 'Pending') {
        style.color = '#f59e0b'; // Orange
        style.weight = 3;
        style.opacity = 1;
    } else if (status === 'No Good to Visit') {
        style.color = '#64748b'; // Slate/Gray
        style.weight = 1;
        style.opacity = 0.5;
        style.fillOpacity = 0.3;
    }

    return style;
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
        // Load status from API first, fallback to localStorage
        try {
            const statusResponse = await fetch('/api/status');
            if (statusResponse.ok) {
                const serverStatus = await statusResponse.json();
                // Merge with localStorage (localStorage takes precedence for new items)
                const localStatus = JSON.parse(localStorage.getItem('foreclosureStatusMap')) || {};
                statusMap = { ...serverStatus, ...localStatus };
                // Sync merged data back to server
                await syncStatusToServer();
            }
        } catch (e) {
            console.log('API not available, using localStorage only');
            statusMap = JSON.parse(localStorage.getItem('foreclosureStatusMap')) || {};
        }

        // Load documents
        const docsResponse = await fetch('data/documents.json');
        documents = await docsResponse.json();
        currentDocs = documents;

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

// Sync status to server
async function syncStatusToServer() {
    try {
        await fetch('/api/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(statusMap)
        });
    } catch (e) {
        console.log('Could not sync to server, saving to localStorage only');
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
    // Clear ALL existing markers (handles duplicate doc_ids)
    allMarkers.forEach(m => map.removeLayer(m));
    allMarkers = [];
    markerMap.clear();

    const docsToShow = filteredDocs || currentDocs;

    docsToShow.forEach(doc => {
        if (doc.lat && doc.lng) {
            const style = getMarkerStyle(doc);

            const marker = L.circleMarker([doc.lat, doc.lng], style);

            marker.bindPopup(`
                <div class="popup-content">
                    <h3>${doc.zone_id || 'Unknown'}</h3>
                    <p><strong>${doc.property_address}</strong></p>
                    <p>Sale Date: ${doc.sale_date || doc.instrument_date}</p>
                    <p>Doc #: ${doc.doc_id}</p>
                    <a href="${doc.doc_url}" target="_blank" style="color: #3b82f6;">View Document →</a>
                    <br>
                    <button onclick="showInList('${doc.doc_id}')" class="btn btn-primary" style="margin-top: 5px; width: 100%;">Show in List</button>
                </div>
            `);

            marker.on('click', () => {
                showInList(doc.doc_id);
            });

            marker.addTo(map);
            allMarkers.push(marker);  // Track all markers for cleanup
            // Only store first occurrence in markerMap (for highlighting)
            if (!markerMap.has(doc.doc_id)) {
                markerMap.set(doc.doc_id, marker);
            }
        }
    });
}

// Filter by zone (from sidebar)
function filterByZone(zoneId) {
    // Clear table header filters to avoid conflicts
    const filterIds = ['filterDocId', 'filterDate', 'filterBorrower', 'filterLender',
        'filterAmount', 'filterAddress', 'filterCity', 'filterZip', 'filterZone', 'filterStatus'];
    filterIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    if (!zoneId) {
        currentDocs = documents;
        renderMarkers();
        renderTable();
        return;
    }

    const filtered = documents.filter(d => d.zone_id === zoneId);
    currentDocs = filtered;
    currentPage = 1;

    // Sync table zone filter
    const tableZone = document.getElementById('filterZone');
    if (tableZone) tableZone.value = zoneId;

    renderMarkers();
    renderTable();
}

// Render data table
function renderTable(filteredDocs = null) {
    const tbody = document.getElementById('tableBody');
    const docsToShow = filteredDocs || currentDocs;

    // Pagination
    const totalPages = Math.ceil(docsToShow.length / pageSize);
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageData = docsToShow.slice(start, end);

    tbody.innerHTML = '';

    pageData.forEach(doc => {
        const tr = document.createElement('tr');
        tr.id = `row-${doc.doc_id}`;
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
                <select class="status-select" onchange="saveStatus('${doc.doc_id}', this.value)">
                    <option value="" ${!statusMap[doc.doc_id] ? 'selected' : ''}>-</option>
                    <option value="Visited" ${statusMap[doc.doc_id] === 'Visited' ? 'selected' : ''}>Visited</option>
                    <option value="Super Good" ${statusMap[doc.doc_id] === 'Super Good' ? 'selected' : ''}>Super Good</option>
                    <option value="Not Visited" ${statusMap[doc.doc_id] === 'Not Visited' ? 'selected' : ''}>Not Visited</option>
                    <option value="Pending" ${statusMap[doc.doc_id] === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="No Good to Visit" ${statusMap[doc.doc_id] === 'No Good to Visit' ? 'selected' : ''}>No Good</option>
                </select>
            </td>
            <td>
                <a href="${doc.doc_url}" target="_blank" class="btn btn-primary">View</a>
                ${doc.lat ? `<a href="https://www.google.com/maps?q=${doc.lat},${doc.lng}" target="_blank" class="btn btn-secondary">Map</a>` : ''}
            </td>
        `;
        tbody.appendChild(tr);

        // Add hover effects for map highlighting
        tr.addEventListener('mouseenter', () => highlightMarker(doc.doc_id));
        tr.addEventListener('mouseleave', () => unhighlightMarker(doc.doc_id));
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

    currentDocs = filtered;
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
        zone: document.getElementById('filterZone').value,
        status: document.getElementById('filterStatus') ? document.getElementById('filterStatus').value : ''
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

        // Status filter
        if (filters.status) {
            const docStatus = statusMap[doc.doc_id] || '';
            if (docStatus !== filters.status) return false;
        }

        return true;
    });

    currentDocs = filtered;
    currentPage = 1;
    renderTable();
    renderMarkers();

    // Sync sidebar zone filter with table zone filter
    const sidebarZone = document.getElementById('zoneFilter');
    const tableZone = document.getElementById('filterZone');
    if (sidebarZone && tableZone && sidebarZone.value !== tableZone.value) {
        sidebarZone.value = tableZone.value || '';
    }
}

// Map Highlighting
function highlightMarker(docId) {
    const marker = markerMap.get(docId);
    if (marker) {
        marker.setStyle({
            color: '#fff',
            weight: 3,
            opacity: 1,
            fillOpacity: 1,
            radius: 8
        });
        marker.bringToFront();
        marker.openPopup();
    }
}

function unhighlightMarker(docId) {
    const marker = markerMap.get(docId);
    if (marker) {
        // Get original color
        const doc = documents.find(d => d.doc_id === docId);
        const style = getMarkerStyle(doc);

        marker.setStyle(style);
        marker.closePopup();
    }
}

// Save status to localStorage and server
window.saveStatus = function (docId, status) {
    statusMap[docId] = status;
    localStorage.setItem('foreclosureStatusMap', JSON.stringify(statusMap));

    // Sync to server
    syncStatusToServer();

    // Update marker style immediately
    const marker = markerMap.get(docId);
    if (marker) {
        const doc = documents.find(d => d.doc_id === docId);
        if (doc) {
            const style = getMarkerStyle(doc);
            marker.setStyle(style);
        }
    }
}

// Add event listeners to all filter inputs
function setupFilterListeners() {
    const filterIds = ['filterDocId', 'filterDate', 'filterBorrower', 'filterLender',
        'filterAmount', 'filterAddress', 'filterCity', 'filterZip', 'filterZone', 'filterStatus'];

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

// Show document in list from map click
window.showInList = function (docId) {
    const index = currentDocs.findIndex(d => d.doc_id === docId);

    if (index === -1) {
        alert('Item is not in the current filtered list.');
        return;
    }

    const targetPage = Math.ceil((index + 1) / pageSize);

    if (currentPage !== targetPage) {
        currentPage = targetPage;
        renderTable();
    }

    // Wait for render
    setTimeout(() => {
        const row = document.getElementById(`row-${docId}`);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.classList.add('highlight-row');
            setTimeout(() => {
                row.classList.remove('highlight-row');
            }, 2000);
        }
    }, 100);
}

// Initialize
initMap();
loadData().then(() => {
    setupFilterListeners();
});
