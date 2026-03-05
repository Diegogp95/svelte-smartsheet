import type { GridPosition, CellValue } from '../types/types.ts';

/**
 * Value object representing a single cell value change.
 * Immutable by convention — never mutate after construction.
 */
export class CellChange {
    constructor(
        public readonly position: GridPosition,
        public readonly oldValue: CellValue,
        public readonly newValue: CellValue,
    ) {}

    getType(): 'cell' {
        return 'cell';
    }

    getPositionKey(): string {
        return `cell-${this.position.row}-${this.position.col}`;
    }

    hasValueChanged(): boolean {
        return this.oldValue !== this.newValue;
    }

    toString(): string {
        return `Cell(${this.position.row},${this.position.col}): ${this.oldValue} → ${this.newValue}`;
    }
}
