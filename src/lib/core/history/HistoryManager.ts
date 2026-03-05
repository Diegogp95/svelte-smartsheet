import type { GridPosition, HeaderPosition, CellValue, HeaderValue } from '../types/types.ts';
import { CellChange } from './CellChange.ts';
import { HeaderChange } from './HeaderChange.ts';
import { ChangeSet } from './ChangeSet.ts';
import { HistoryStack } from './HistoryStack.ts';
import { HistoryQueryReader } from './HistoryQueryReader.ts';

export type ChangeType = 'single-edit' | 'paste' | 'delete' | 'format' | 'other';

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
        type: ChangeType
    ): void {
        const cellChanges = changes.map(c => new CellChange(c.position, c.oldValue, c.newValue));
        this.stack.push(new ChangeSet(cellChanges, type));
    }

    recordHeaderChanges(
        changes: Array<{ position: HeaderPosition; oldValue: HeaderValue; newValue: HeaderValue }>,
        type: ChangeType
    ): void {
        const headerChanges = changes.map(c => new HeaderChange(c.position, c.oldValue, c.newValue));
        this.stack.push(new ChangeSet(headerChanges, type));
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

    getCurrentIndex(): number {
        return this.stack.getCursor();
    }

    getHistoryLength(): number {
        return this.stack.getLength();
    }

    getChangeAt(index: number): ChangeSet | null {
        return this.stack.getAt(index);
    }

    clear(): void {
        this.stack.clear();
    }

    clearFrom(index: number): void {
        this.stack.clearFrom(index);
    }

    setMaxHistorySize(size: number): void {
        this.stack.setMaxSize(size);
    }

    getMaxHistorySize(): number {
        return this.stack.getMaxSize();
    }

    // ==================== DOMAIN QUERIES ====================

    getChangedCells(): GridPosition[] {
        return this.reader.getChangedCells();
    }

    getChangedHeaders(): { rows: HeaderPosition[]; cols: HeaderPosition[] } {
        return this.reader.getChangedHeaders();
    }

    getChangedElements(): {
        cells: GridPosition[];
        rowHeaders: HeaderPosition[];
        colHeaders: HeaderPosition[];
    } {
        return this.reader.getChangedElements();
    }

    // ==================== PRIVATE ====================

    private toResult(changeSet: ChangeSet): UndoRedoResult {
        if (changeSet.isCellOnlyEdit()) {
            return {
                type: 'cell',
                changes: (changeSet.changes as CellChange[]).map(c => ({
                    position: c.position,
                    oldValue: c.oldValue,
                    newValue: c.newValue,
                })),
            };
        }
        return {
            type: 'header',
            changes: (changeSet.changes as HeaderChange[]).map(c => ({
                position: c.position,
                oldValue: c.oldValue,
                newValue: c.newValue,
            })),
        };
    }
}
