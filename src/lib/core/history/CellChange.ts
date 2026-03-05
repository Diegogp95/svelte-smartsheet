import type { GridPosition, CellValue } from '../types/types.ts';
import type { Change } from './Change.ts';

/**
 * Value object representing a single cell value change.
 * Immutable by convention — never mutate after construction.
 */
export class CellChange implements Change<GridPosition, CellValue> {
    readonly domain  = 'data' as const;
    readonly element = 'cell' as const;
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
