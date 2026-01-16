// Geocoder module - converts addresses to coordinates using US Census Bureau Geocoder
// Free, no API key required, designed for US addresses

import { config } from './config';

interface GeocodingResult {
    lat: number;
    lng: number;
    displayName: string;
}

// Simple rate limiter
let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < 500) { // 500ms between requests
        await new Promise(resolve =>
            setTimeout(resolve, 500 - timeSinceLastRequest)
        );
    }

    lastRequestTime = Date.now();
}

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
    if (!address || address.trim() === '') {
        return null;
    }

    await rateLimit();

    try {
        // Use US Census Bureau Geocoding API
        const params = new URLSearchParams({
            address: address,
            benchmark: 'Public_AR_Current',
            format: 'json'
        });

        const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${params.toString()}`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            console.error(`Geocoding failed for "${address}": HTTP ${response.status}`);
            return null;
        }

        const data = await response.json();

        if (data?.result?.addressMatches && data.result.addressMatches.length > 0) {
            const match = data.result.addressMatches[0];
            return {
                lat: match.coordinates.y,
                lng: match.coordinates.x,
                displayName: match.matchedAddress
            };
        }

        console.log(`No geocode results for: ${address}`);
        return null;
    } catch (error) {
        console.error(`Geocoding error for "${address}":`, error);
        return null;
    }
}

export async function geocodeAddresses(
    addresses: string[],
    progressCallback?: (current: number, total: number, address: string) => void
): Promise<Map<string, GeocodingResult | null>> {
    const results = new Map<string, GeocodingResult | null>();

    // Deduplicate addresses to reduce API calls
    const uniqueAddresses = [...new Set(addresses.filter(a => a && a.trim()))];

    for (let i = 0; i < uniqueAddresses.length; i++) {
        const address = uniqueAddresses[i];

        if (progressCallback) {
            progressCallback(i + 1, uniqueAddresses.length, address);
        }

        const result = await geocodeAddress(address);
        results.set(address, result);
    }

    return results;
}

// Calculate distance between two coordinates using Haversine formula
export function haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 3959; // Earth's radius in miles

    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in miles
}

function toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
}
