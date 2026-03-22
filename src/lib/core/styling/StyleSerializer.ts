import type { BackgroundProperties } from '../types/types.ts';

/**
 * Default BackgroundProperties for data cells.
 */
export const DEFAULT_CELL_BACKGROUND_PROPERTIES: BackgroundProperties = {
    'background-color':    'transparent',
    'border-top-color':    'var(--ss-border-color)',
    'border-top-width':    '1px',
    'border-top-style':    'solid',
    'border-right-color':  'var(--ss-border-color)',
    'border-right-width':  '1px',
    'border-right-style':  'solid',
    'border-bottom-color': 'var(--ss-border-color)',
    'border-bottom-width': '1px',
    'border-bottom-style': 'solid',
    'border-left-color':   'var(--ss-border-color)',
    'border-left-width':   '1px',
    'border-left-style':   'solid',
    'opacity': 1,
    'color': 'inherit',
};

/**
 * Default BackgroundProperties for header cells (row, col, corner).
 */
export const DEFAULT_HEADER_BACKGROUND_PROPERTIES: BackgroundProperties = {
    'background-color':    'var(--ss-header-bg)',
    'border-right-color':  'var(--ss-border-color)',
    'border-right-width':  '1px',
    'border-right-style':  'solid',
    'border-bottom-color': 'var(--ss-border-color)',
    'border-bottom-width': '1px',
    'border-bottom-style': 'solid',
    'border-left-color':   'var(--ss-border-color)',
    'border-left-width':   '1px',
    'border-left-style':   'solid',
    'border-top-color':    'var(--ss-border-color)',
    'border-top-width':    '1px',
    'border-top-style':    'solid',
    'opacity': 1,
    'color': 'inherit',
};

/** Pre-calculated default style strings (computed once at module load). */
export const DEFAULT_CELL_STYLE_STRING: string = bgPropertiesToString(DEFAULT_CELL_BACKGROUND_PROPERTIES);
export const DEFAULT_HEADER_STYLE_STRING: string = bgPropertiesToString(DEFAULT_HEADER_BACKGROUND_PROPERTIES);

/**
 * Serialize a BackgroundProperties object to an inline CSS string.
 */
export function bgPropertiesToString(properties: BackgroundProperties): string {
    return Object.entries(properties)
        .map(([key, value]) => `${key}: ${value};`)
        .join(' ');
}

/**
 * Parse an inline CSS style string back into a BackgroundProperties object.
 * Only known BackgroundProperties keys are included.
 */
export function parseStyleString(styleString: string): BackgroundProperties {
    const properties: BackgroundProperties = {};
    if (!styleString) return properties;

    const declarations = styleString.split(';').filter(decl => decl.trim());

    for (const declaration of declarations) {
        const colonIndex = declaration.indexOf(':');
        if (colonIndex === -1) continue;

        const property = declaration.substring(0, colonIndex).trim() as keyof BackgroundProperties;
        const value = declaration.substring(colonIndex + 1).trim();

        if (property in DEFAULT_CELL_BACKGROUND_PROPERTIES || property in DEFAULT_HEADER_BACKGROUND_PROPERTIES) {
            if (property === 'opacity') {
                properties[property] = parseFloat(value) || 1;
            } else {
                (properties as any)[property] = value;
            }
        }
    }

    return properties;
}

/**
 * Merge a partial set of new properties onto an existing inline style string.
 * Preserves existing properties not present in `newProperties`.
 */
export function mergeStyleString(existing: string, newProperties: BackgroundProperties): string {
    return bgPropertiesToString({ ...parseStyleString(existing), ...newProperties });
}
