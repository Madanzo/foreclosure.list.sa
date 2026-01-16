// Zoning module - clusters addresses into geographic zones

import { config, ExtractedDocument, Zone } from './config';
import { haversineDistance } from './geocoder';

interface GeoPoint {
    index: number;
    lat: number;
    lng: number;
}

export function clusterDocuments(documents: ExtractedDocument[]): ExtractedDocument[] {
    // Extract documents with valid coordinates
    const geoPoints: GeoPoint[] = [];

    documents.forEach((doc, index) => {
        if (doc.lat !== null && doc.lng !== null) {
            geoPoints.push({ index, lat: doc.lat, lng: doc.lng });
        }
    });

    if (geoPoints.length === 0) {
        return documents;
    }

    // Perform DBSCAN-style clustering using radius in miles
    const clusters = dbscanCluster(geoPoints, config.clustering.radiusMiles);

    // Assign zone IDs to documents
    const result = [...documents];

    clusters.forEach((cluster, clusterIndex) => {
        const zoneId = `Zone ${String.fromCharCode(65 + clusterIndex)}`; // Zone A, Zone B, etc.

        cluster.forEach(point => {
            result[point.index].zone_id = zoneId;
        });
    });

    // Mark unclustered documents as their own zones
    let noiseCount = clusters.length;
    result.forEach((doc, index) => {
        if (doc.lat !== null && doc.lng !== null && doc.zone_id === null) {
            doc.zone_id = `Zone ${String.fromCharCode(65 + noiseCount)}`;
            noiseCount++;
        }
    });

    return result;
}

function dbscanCluster(points: GeoPoint[], radiusMiles: number): GeoPoint[][] {
    const visited = new Set<number>();
    const clusters: GeoPoint[][] = [];

    for (const point of points) {
        if (visited.has(point.index)) continue;

        const neighbors = getNeighbors(point, points, radiusMiles);

        if (neighbors.length >= 1) { // Min points = 1 (include singleton clusters)
            const cluster = expandCluster(point, neighbors, points, visited, radiusMiles);
            clusters.push(cluster);
        }
    }

    return clusters;
}

function getNeighbors(point: GeoPoint, allPoints: GeoPoint[], radiusMiles: number): GeoPoint[] {
    return allPoints.filter(other => {
        if (point.index === other.index) return false;
        const distance = haversineDistance(point.lat, point.lng, other.lat, other.lng);
        return distance <= radiusMiles;
    });
}

function expandCluster(
    point: GeoPoint,
    neighbors: GeoPoint[],
    allPoints: GeoPoint[],
    visited: Set<number>,
    radiusMiles: number
): GeoPoint[] {
    const cluster = [point];
    visited.add(point.index);

    const queue = [...neighbors];

    while (queue.length > 0) {
        const current = queue.shift()!;

        if (visited.has(current.index)) continue;
        visited.add(current.index);

        cluster.push(current);

        const currentNeighbors = getNeighbors(current, allPoints, radiusMiles);
        queue.push(...currentNeighbors.filter(n => !visited.has(n.index)));
    }

    return cluster;
}

export function calculateZoneSummaries(documents: ExtractedDocument[]): Zone[] {
    // Group documents by zone
    const zoneGroups = new Map<string, ExtractedDocument[]>();

    documents.forEach(doc => {
        if (doc.zone_id) {
            const group = zoneGroups.get(doc.zone_id) || [];
            group.push(doc);
            zoneGroups.set(doc.zone_id, group);
        }
    });

    // Calculate summaries
    const zones: Zone[] = [];

    zoneGroups.forEach((docs, zoneId) => {
        // Calculate centroid
        const validDocs = docs.filter(d => d.lat !== null && d.lng !== null);

        if (validDocs.length === 0) return;

        const sumLat = validDocs.reduce((sum, d) => sum + (d.lat || 0), 0);
        const sumLng = validDocs.reduce((sum, d) => sum + (d.lng || 0), 0);

        const centroidLat = sumLat / validDocs.length;
        const centroidLng = sumLng / validDocs.length;

        // Get sample addresses (up to 3)
        const sampleAddresses = docs
            .slice(0, 3)
            .map(d => d.property_address)
            .filter(a => a);

        // Create Google Maps link
        const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${centroidLat},${centroidLng}`;

        zones.push({
            zone_id: zoneId,
            count: docs.length,
            centroid_lat: centroidLat,
            centroid_lng: centroidLng,
            sample_addresses: sampleAddresses,
            google_maps_link: googleMapsLink
        });
    });

    // Sort zones by size (descending)
    return zones.sort((a, b) => b.count - a.count);
}
