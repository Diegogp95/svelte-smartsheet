import type { GridPosition, HeaderPosition } from '../types/types.ts';
import { CellChange } from './CellChange.ts';
import { HeaderChange } from './HeaderChange.ts';

/**
 * Value object representing an atomic group of changes that form a single
 * undoable/redoable unit of work (e.g. a paste, a delete, a single edit).
 */
export class ChangeSet {
    constructor(
        public readonly changes: CellChange[] | HeaderChange[],
        public readonly type: 'single-edit' | 'paste' | 'delete' | 'format' | 'other',
        public readonly timestamp: number = Date.now(),
    ) {}

    getAffectedPositions(): (GridPosition | HeaderPosition)[] {
        return this.changes.map(c => c.position);
    }

    getCellPositions(): GridPosition[] {
        return this.isCellOnlyEdit()
            ? (this.changes as CellChange[]).map(c => c.position)
            : [];
    }

    getHeaderPositions(): HeaderPosition[] {
        return this.isHeaderOnlyEdit()
            ? (this.changes as HeaderChange[]).map(c => c.position)
            : [];
    }

    getChangeCount(): number {
        return this.changes.length;
    }

    isSingleCellEdit(): boolean {
        return this.type === 'single-edit' && this.changes.length === 1 && this.isCellOnlyEdit();
    }

    isSingleHeaderEdit(): boolean {
        return this.type === 'single-edit' && this.changes.length === 1 && this.isHeaderOnlyEdit();
    }

    isCellOnlyEdit(): boolean {
        return this.changes.length > 0 && this.changes[0] instanceof CellChange;
    }

    isHeaderOnlyEdit(): boolean {
        return this.changes.length > 0 && this.changes[0] instanceof HeaderChange;
    }

    toString(): string {
        if (this.isCellOnlyEdit()) {
            return `ChangeSet(${this.type}): ${this.changes.length} cells at ${new Date(this.timestamp)}`;
        } else if (this.isHeaderOnlyEdit()) {
            return `ChangeSet(${this.type}): ${this.changes.length} headers at ${new Date(this.timestamp)}`;
        } else {
            return `ChangeSet(${this.type}): 0 changes at ${new Date(this.timestamp)}`;
        }
    }
}
