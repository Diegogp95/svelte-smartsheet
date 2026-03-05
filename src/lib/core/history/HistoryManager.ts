import type { GridPosition, HeaderPosition, CellValue, HeaderValue } from '../types/types.ts';
import type { AnyChange } from './Change.ts';
import { CellChange } from './CellChange.ts';
import { HeaderChange } from './HeaderChange.ts';
import { ChangeSet } from './ChangeSet.ts';
import type { ChangeOrigin } from './ChangeSet.ts';
import { HistoryStack } from './HistoryStack.ts';
import { HistoryQueryReader } from './HistoryQueryReader.ts';

// ChangeOrigin is defined in ChangeSet.ts (its natural home) and re-exported here
// so all callers continue to import from a single location.
export type { ChangeOrigin } from './ChangeSet.ts';

export type UndoRedoResult =
    | { type: 'cell';   changes: Array<{ position: GridPosition;   oldValue: CellValue;   newValue: CellValue }> }
    | { type: 'header'; changes: Array<{ position: HeaderPosition; oldValue: HeaderValue; newValue: HeaderValue }> };





/**
 * HistoryManager — domain façade over HistoryStack<ChangeSet>.
 *
 * Responsibilities:
 *   - Accept raw change data and build domain objects internally.
 *   - Delegate stack management to HistoryStack.
 *   - Expose undo/redo as typed DTOs — callers never handle ChangeSet directly.
 *   - Expose domain-level queries: which cells/headers have been modified.
 */
export class HistoryManager {
    private readonly stack = new HistoryStack<ChangeSet>();
    private readonly reader = new HistoryQueryReader(this.stack);

    recordCellChanges(
        changes: Array<{ position: GridPosition; oldValue: CellValue; newValue: CellValue }>,
        origin: ChangeOrigin
    ): void {
        this.record(changes.map(c => new CellChange(c.position, c.oldValue, c.newValue)), origin);
    }

    recordHeaderChanges(
        changes: Array<{ position: HeaderPosition; oldValue: HeaderValue; newValue: HeaderValue }>,
        origin: ChangeOrigin
    ): void {
        this.record(changes.map(c => new HeaderChange(c.position, c.oldValue, c.newValue)), origin);
    }

    undo(): UndoRedoResult | null {
        const changeSet = this.stack.undo();
        return changeSet ? this.toResult(changeSet) : null;
    }

    redo(): UndoRedoResult | null {
        const changeSet = this.stack.redo();
        return changeSet ? this.toResult(changeSet) : null;
    }

    canUndo(): boolean {
        return this.stack.canUndo();
    }

    canRedo(): boolean {
        return this.stack.canRedo();
    }

    clear(): void {
        this.stack.clear();
    }

    // ==================== DOMAIN QUERIES ====================

    getChangedCells(): GridPosition[] {
        return this.reader.getChangedCells();
    }

    getChangedElements(): {
        cells: GridPosition[];
        rowHeaders: HeaderPosition[];
        colHeaders: HeaderPosition[];
    } {
        return this.reader.getChangedElements();
    }

    // ==================== PRIVATE ====================

    private record(changes: AnyChange[], origin: ChangeOrigin): void {
        const domain  = changes.length > 0 ? changes[0].domain  : 'unknown';
        const element = changes.length > 0 ? changes[0].element : 'unknown';
        this.stack.push(new ChangeSet(changes, origin, domain, element));
    }

    private toResult(changeSet: ChangeSet): UndoRedoResult {
        switch (changeSet.element) {
            case 'cell':
                return {
                    type: 'cell',
                    changes: changeSet.changes.map(c => ({
                        position: c.position as GridPosition,
                        oldValue: c.oldValue as CellValue,
                        newValue: c.newValue as CellValue,
                    })),
                };
            default:
                return {
                    type: 'header',
                    changes: changeSet.changes.map(c => ({
                        position: c.position as HeaderPosition,
                        oldValue: c.oldValue as HeaderValue,
                        newValue: c.newValue as HeaderValue,
                    })),
                };
        }
    }
}
