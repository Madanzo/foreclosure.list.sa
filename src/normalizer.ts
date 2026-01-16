// Address normalizer - standardizes address formatting

export function normalizeAddress(address: string): string {
    if (!address) return '';

    let normalized = address
        // Remove extra whitespace
        .replace(/\s+/g, ' ')
        .trim()
        // Standardize directional abbreviations
        .replace(/\bNORTH\b/gi, 'N')
        .replace(/\bSOUTH\b/gi, 'S')
        .replace(/\bEAST\b/gi, 'E')
        .replace(/\bWEST\b/gi, 'W')
        .replace(/\bNORTHEAST\b/gi, 'NE')
        .replace(/\bNORTHWEST\b/gi, 'NW')
        .replace(/\bSOUTHEAST\b/gi, 'SE')
        .replace(/\bSOUTHWEST\b/gi, 'SW')
        // Standardize street type abbreviations
        .replace(/\bSTREET\b/gi, 'ST')
        .replace(/\bAVENUE\b/gi, 'AVE')
        .replace(/\bBOULEVARD\b/gi, 'BLVD')
        .replace(/\bDRIVE\b/gi, 'DR')
        .replace(/\bLANE\b/gi, 'LN')
        .replace(/\bCOURT\b/gi, 'CT')
        .replace(/\bCIRCLE\b/gi, 'CIR')
        .replace(/\bPLACE\b/gi, 'PL')
        .replace(/\bROAD\b/gi, 'RD')
        .replace(/\bPARKWAY\b/gi, 'PKWY')
        .replace(/\bHIGHWAY\b/gi, 'HWY')
        // Standardize state to TX
        .replace(/,?\s*TEXAS\s*,?/gi, ', TX ')
        // Standardize unit indicators
        .replace(/\bAPARTMENT\b/gi, 'APT')
        .replace(/\bSUITE\b/gi, 'STE')
        .replace(/\bUNIT\b/gi, 'UNIT')
        .replace(/\bBUILDING\b/gi, 'BLDG')
        // Clean up spacing around commas
        .replace(/\s*,\s*/g, ', ')
        // Remove double spaces
        .replace(/\s+/g, ' ')
        .trim();

    return normalized.toUpperCase();
}

export function normalizeOrgName(name: string): string {
    if (!name) return '';

    return name
        // Remove extra whitespace
        .replace(/\s+/g, ' ')
        .trim()
        // Standardize common suffixes (but keep them)
        .replace(/\bN\.?\s*A\.?\b/gi, 'N.A.')
        .replace(/\bL\.?\s*L\.?\s*C\.?\b/gi, 'LLC')
        .replace(/\bINC\.?\b/gi, 'Inc.')
        .replace(/\bCORP\.?\b/gi, 'Corp.')
        .replace(/\bL\.?\s*P\.?\b/gi, 'L.P.')
        .replace(/\bL\.?\s*L\.?\s*P\.?\b/gi, 'LLP');
}

export function parseAddressComponents(address: string): {
    street: string;
    city: string;
    state: string;
    zip: string;
} {
    const parts = address.split(',').map(p => p.trim());

    let street = '';
    let city = '';
    let state = 'TX';
    let zip = '';

    // Extract ZIP code
    const zipMatch = address.match(/\b(\d{5}(?:-\d{4})?)\b/);
    if (zipMatch) {
        zip = zipMatch[1];
    }

    if (parts.length >= 1) {
        street = parts[0];
    }

    if (parts.length >= 2) {
        // Second part is usually the city
        city = parts[1].replace(/\s*\d{5}.*$/, '').trim();
    }

    // Check for state
    const stateMatch = address.match(/\b(TX|TEXAS)\b/i);
    if (stateMatch) {
        state = 'TX';
    }

    return { street, city, state, zip };
}

export function formatStandardAddress(
    street: string,
    city: string,
    state: string = 'TX',
    zip: string
): string {
    const parts = [street, city, state, zip].filter(p => p && p.trim());
    return parts.join(', ');
}
