import type { GridPosition, HeaderPosition } from '../types/types.ts';
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
            if (cs?.element !== 'cell') continue;
            for (const change of cs.changes) {
                const pos = change.position as GridPosition;
                const key = `${pos.row}-${pos.col}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    result.push(pos);
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
            if (cs?.element !== 'header') continue;
            for (const change of cs.changes) {
                const pos = change.position as HeaderPosition;
                if (pos.headerType === 'row' && !seenRows.has(pos.index)) {
                    seenRows.add(pos.index);
                    rows.push(pos);
                } else if (pos.headerType === 'col' && !seenCols.has(pos.index)) {
                    seenCols.add(pos.index);
                    cols.push(pos);
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
            if (cs.element === 'cell') {
                for (const change of cs.changes) {
                    const pos = change.position as GridPosition;
                    const key = `${pos.row}-${pos.col}`;
                    if (!cellKeys.has(key)) {
                        cellKeys.add(key);
                        cells.push(pos);
                    }
                }
            } else if (cs.element === 'header') {
                for (const change of cs.changes) {
                    const pos = change.position as HeaderPosition;
                    if (pos.headerType === 'row' && !rowKeys.has(pos.index)) {
                        rowKeys.add(pos.index);
                        rowHeaders.push(pos);
                    } else if (pos.headerType === 'col' && !colKeys.has(pos.index)) {
                        colKeys.add(pos.index);
                        colHeaders.push(pos);
                    }
                }
            }
        }
        return { cells, rowHeaders, colHeaders };
    }
}
