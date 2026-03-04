import type { FlashColor } from '../../../core/types/types.ts';

/**
 * Resolves a FlashColor name or raw CSS color string into a
 * primary/secondary rgba pair suitable for the .flash animation.
 *
 * Lives in the adapter because color-to-CSS resolution is a
 * presentational concern — the core only declares intent (which
 * component to flash and at what conceptual color).
 */
export function getFlashColors(color: FlashColor | string): { primary: string; secondary: string } {
    const predefined: Record<FlashColor, { primary: string; secondary: string }> = {
        blue:    { primary: 'rgba(59, 130, 246, 0.3)',  secondary: 'rgba(59, 130, 246, 0.6)' },
        green:   { primary: 'rgba(34, 197, 94, 0.3)',   secondary: 'rgba(34, 197, 94, 0.6)' },
        red:     { primary: 'rgba(239, 68, 68, 0.3)',   secondary: 'rgba(239, 68, 68, 0.6)' },
        orange:  { primary: 'rgba(249, 115, 22, 0.3)',  secondary: 'rgba(249, 115, 22, 0.6)' },
        yellow:  { primary: 'rgba(234, 179, 8, 0.3)',   secondary: 'rgba(234, 179, 8, 0.6)' },
        purple:  { primary: 'rgba(128, 0, 128, 0.3)',   secondary: 'rgba(128, 0, 128, 0.6)' },
        pink:    { primary: 'rgba(236, 72, 153, 0.3)',  secondary: 'rgba(236, 72, 153, 0.6)' },
        cyan:    { primary: 'rgba(6, 182, 212, 0.3)',   secondary: 'rgba(6, 182, 212, 0.6)' },
        magenta: { primary: 'rgba(255, 0, 255, 0.3)',   secondary: 'rgba(255, 0, 255, 0.6)' },
    };

    if (color in predefined) {
        return predefined[color as FlashColor];
    }

    // Hex → rgba
    if (color.startsWith('#')) {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return { primary: `rgba(${r}, ${g}, ${b}, 0.3)`, secondary: `rgba(${r}, ${g}, ${b}, 0.6)` };
    }

    // rgb(...) → rgba
    if (color.startsWith('rgb(')) {
        const values = color.match(/\d+/g);
        if (values && values.length === 3) {
            const [r, g, b] = values;
            return { primary: `rgba(${r}, ${g}, ${b}, 0.3)`, secondary: `rgba(${r}, ${g}, ${b}, 0.6)` };
        }
    }

    // Fallback: pass through as-is (e.g. already an rgba string)
    return { primary: color, secondary: color };
}
