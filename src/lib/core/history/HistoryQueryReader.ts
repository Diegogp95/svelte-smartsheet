import type { GridPosition, HeaderPosition } from '../types/types.ts';
import { CellChange } from './CellChange.ts';
import { HeaderChange } from './HeaderChange.ts';
import type { ChangeSet } from './ChangeSet.ts';
import type { HistoryStack } from './HistoryStack.ts';

/**
 * HistoryQueryReader — read-only traversal of an applied HistoryStack<ChangeSet>.
 *
 * Single responsibility: answer "what has been modified up to the current cursor?"
 * It never mutates the stack, only reads it.
 */
export class HistoryQueryReader {
    constructor(private readonly stack: HistoryStack<ChangeSet>) {}

    getChangedCells(): GridPosition[] {
        const seen = new Set<string>();
        const result: GridPosition[] = [];
        for (let i = 0; i <= this.stack.getCursor(); i++) {
            const cs = this.stack.getAt(i);
            if (!cs?.isCellOnlyEdit()) continue;
            for (const change of cs.changes as CellChange[]) {
                const key = `${change.position.row}-${change.position.col}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    result.push(change.position);
                }
            }
        }
        return result;
    }

    getChangedHeaders(): { rows: HeaderPosition[]; cols: HeaderPosition[] } {
        const seenRows = new Set<number>();
        const seenCols = new Set<number>();
        const rows: HeaderPosition[] = [];
        const cols: HeaderPosition[] = [];
        for (let i = 0; i <= this.stack.getCursor(); i++) {
            const cs = this.stack.getAt(i);
            if (!cs?.isHeaderOnlyEdit()) continue;
            for (const change of cs.changes as HeaderChange[]) {
                if (change.position.headerType === 'row' && !seenRows.has(change.position.index)) {
                    seenRows.add(change.position.index);
                    rows.push(change.position);
                } else if (change.position.headerType === 'col' && !seenCols.has(change.position.index)) {
                    seenCols.add(change.position.index);
                    cols.push(change.position);
                }
            }
        }
        return { rows, cols };
    }

    getChangedElements(): {
        cells: GridPosition[];
        rowHeaders: HeaderPosition[];
        colHeaders: HeaderPosition[];
    } {
        const cellKeys = new Set<string>();
        const rowKeys  = new Set<number>();
        const colKeys  = new Set<number>();
        const cells: GridPosition[]        = [];
        const rowHeaders: HeaderPosition[] = [];
        const colHeaders: HeaderPosition[] = [];

        for (let i = 0; i <= this.stack.getCursor(); i++) {
            const cs = this.stack.getAt(i);
            if (!cs) continue;
            if (cs.isCellOnlyEdit()) {
                for (const change of cs.changes as CellChange[]) {
                    const key = `${change.position.row}-${change.position.col}`;
                    if (!cellKeys.has(key)) {
                        cellKeys.add(key);
                        cells.push(change.position);
                    }
                }
            } else if (cs.isHeaderOnlyEdit()) {
                for (const change of cs.changes as HeaderChange[]) {
                    if (change.position.headerType === 'row' && !rowKeys.has(change.position.index)) {
                        rowKeys.add(change.position.index);
                        rowHeaders.push(change.position);
                    } else if (change.position.headerType === 'col' && !colKeys.has(change.position.index)) {
                        colKeys.add(change.position.index);
                        colHeaders.push(change.position);
                    }
                }
            }
        }
        return { cells, rowHeaders, colHeaders };
    }
}
