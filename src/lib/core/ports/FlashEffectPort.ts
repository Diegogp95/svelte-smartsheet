/**
 * Port definition: FlashEffectPort
 *
 * Abstracts DOM manipulation required to trigger a visual flash animation
 * on a rendered cell or header element.
 *
 * The core (ColorHandler) is responsible for:
 *   - Deciding WHICH components to flash (filter by visible area, position lookup)
 *   - Resolving flash options (color → CSS values, default duration)
 *
 * The adapter is responsible for:
 *   - Finding the rendered DOM element by position + instanceId
 *   - Applying CSS custom properties and the 'flash' class
 *   - Scheduling class removal via setTimeout
 */

export type FlashTarget =
    | { type: 'cell'; row: number; col: number }
    | { type: 'header'; headerType: 'row' | 'col' | 'corner'; index: number };

/**
 * Options passed from the core to the adapter when triggering a flash.
 * The adapter is responsible for resolving `color` into concrete CSS values.
 */
export interface FlashCallOptions {
    /** Conceptual color name or raw CSS color string (hex, rgb, rgba). */
    color: string;
    /** Duration in milliseconds. */
    duration: number;
}

export interface FlashEffectPort {
    /**
     * Trigger a flash animation on the rendered element corresponding to `target`.
     * No-op if the element is not currently in the DOM (e.g. scrolled out of view).
     */
    flash(target: FlashTarget, options: FlashCallOptions): void;
}
