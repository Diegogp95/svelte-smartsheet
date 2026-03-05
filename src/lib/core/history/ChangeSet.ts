import type { GridPosition, HeaderPosition } from '../types/types.ts';
import type { AnyChange } from './Change.ts';

/**
 * Semantic classification of what triggered a group of changes.
 * Extendable by adding new literals — no existing switch/if needs modification.
 */
export type ChangeOrigin = 'single-edit' | 'paste' | 'delete' | 'format' | 'other';

/**
 * Value object representing an atomic group of changes that form a single
 * undoable/redoable unit of work (e.g. a paste, a delete, a single edit).
 *
 * Uses `domain` and `element` from the first change as discriminants — no
 * instanceof checks needed, and new change kinds extend cleanly without
 * touching this class.
 */
export class ChangeSet {
    constructor(
        public readonly changes: AnyChange[],
        public readonly origin: ChangeOrigin,
        public readonly domain: string,
        public readonly element: string,
        public readonly timestamp: number = Date.now(),
    ) {}

    getAffectedPositions(): (GridPosition | HeaderPosition)[] {
        return this.changes.map(c => c.position as GridPosition | HeaderPosition);
    }

    getPositions<T>(element: string): T[] {
        return this.element === element
            ? this.changes.map(c => c.position as T)
            : [];
    }

    getChangeCount(): number {
        return this.changes.length;
    }

    isSingleEdit(element?: string): boolean {
        return this.origin === 'single-edit' && this.changes.length === 1
            && (element === undefined || this.element === element);
    }

    toString(): string {
        return `ChangeSet(${this.origin}): ${this.changes.length} ${this.element}(s) from ${this.domain} at ${new Date(this.timestamp)}`;
    }
}
