import type {
    FlashColor,
    GridPosition,
    HeaderPosition,
} from '../types/types.ts';

/**
 * Helper function to get flash colors for animations
 */
export function getFlashColors(color: FlashColor | string): { primary: string, secondary: string } {
    const predefinedColors = {
        blue: {
            primary: 'rgba(59, 130, 246, 0.3)', // blue-500
            secondary: 'rgba(59, 130, 246, 0.6)'
        },
        green: {
            primary: 'rgba(34, 197, 94, 0.3)', // green-500
            secondary: 'rgba(34, 197, 94, 0.6)'
        },
        red: {
            primary: 'rgba(239, 68, 68, 0.3)', // red-500
            secondary: 'rgba(239, 68, 68, 0.6)'
        },
        orange: {
            primary: 'rgba(249, 115, 22, 0.3)', // orange-500
            secondary: 'rgba(249, 115, 22, 0.6)'
        },
        yellow: {
            primary: 'rgba(234, 179, 8, 0.3)', // yellow-500
            secondary: 'rgba(234, 179, 8, 0.6)'
        },
        purple: {
            primary: 'rgba(128, 0, 128, 0.3)', // purple-500
            secondary: 'rgba(128, 0, 128, 0.6)'
        },
        pink: {
            primary: 'rgba(236, 72, 153, 0.3)', // pink-500
            secondary: 'rgba(236, 72, 153, 0.6)'
        },
        cyan: {
            primary: 'rgba(6, 182, 212, 0.3)', // cyan-500
            secondary: 'rgba(6, 182, 212, 0.6)'
        },
        magenta: {
            primary: 'rgba(255, 0, 255, 0.3)', // magenta-500
            secondary: 'rgba(255, 0, 255, 0.6)'
        }
    };

    // Check if it's a predefined color
    if (color in predefinedColors) {
        return predefinedColors[color as FlashColor];
    }

    // Handle custom RGB/hex colors
    // For custom colors, we'll try to parse and add opacity
    if (typeof color === 'string') {
        // If it's a hex color, convert to rgba
        if (color.startsWith('#')) {
            const hex = color.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);

            return {
                primary: `rgba(${r}, ${g}, ${b}, 0.3)`,
                secondary: `rgba(${r}, ${g}, ${b}, 0.6)`
            };
        }

        // If it's already an rgba/rgb, we'll modify the alpha
        if (color.startsWith('rgb(')) {
            const rgbValues = color.match(/\d+/g);
            if (rgbValues && rgbValues.length === 3) {
                const [r, g, b] = rgbValues;
                return {
                    primary: `rgba(${r}, ${g}, ${b}, 0.3)`,
                    secondary: `rgba(${r}, ${g}, ${b}, 0.6)`
                };
            }
        }

        // For any other format, just use it as is with opacity suffixes (fallback)
        return {
            primary: `${color}4D`, // Add 30% opacity (4D in hex)
            secondary: `${color}99`  // Add 60% opacity (99 in hex)
        };
    }

    // Fallback to blue if nothing else works
    return {
        primary: 'rgba(59, 130, 246, 0.3)',
        secondary: 'rgba(59, 130, 246, 0.6)'
    };
}

export function generateColumnLabel(index: number): string {
    let result = '';
    let num = index;

    do {
        result = String.fromCharCode(65 + (num % 26)) + result;
        num = Math.floor(num / 26) - 1;
    } while (num >= 0);

    return result;
}
