/**
 * Generic interface for a single reversible change in the history domain.
 *
 * TPosition — the coordinate type (e.g. GridPosition, HeaderPosition, StylePosition).
 * TValue    — the value type    (e.g. CellValue, HeaderValue, StyleValue).
 *
 * Implementing a new change kind (e.g. StyleChange) only requires:
 *   1. A new class that implements Change<StylePosition, StyleValue>.
 *   2. Setting `domain` (e.g. 'style') and `element` (e.g. 'cell-style').
 * No existing files need to be modified — OCP-compliant by design.
 */
export interface Change<TPosition, TValue> {
    /** High-level domain the change belongs to: 'data' | 'style' | … */
    readonly domain: string;
    /** Element kind within the domain: 'cell' | 'header' | … */
    readonly element: string;
    readonly position: TPosition;
    readonly oldValue: TValue;
    readonly newValue: TValue;
    getPositionKey(): string;
    hasValueChanged(): boolean;
    toString(): string;
}

/** Convenience alias for use in collections that hold any change kind. */
export type AnyChange = Change<unknown, unknown>;
