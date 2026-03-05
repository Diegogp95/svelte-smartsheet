import type { GridPosition, HeaderPosition } from '../types/types.ts';
import type { HistoryManager } from '../history/HistoryManager.ts';

/**
 * ImputationTracker — maintains Sets of keys for cells and headers whose values
 * have been changed through history, enabling efficient "is imputed?" lookups.
 *
 * Delegates history queries entirely to HistoryManager; owns only the derived Sets.
 */
export class ImputationTracker {
    private imputedCells = new Set<string>();
    private imputedRowHeaders = new Set<string>();
    private imputedColHeaders = new Set<string>();

    constructor(private readonly historyManager: HistoryManager) {}

    /**
     * Resync the imputed sets from the current history state.
     * Call this after every successful commit, undo, or redo.
     */
    sync(): void {
        this.imputedCells.clear();
        this.imputedRowHeaders.clear();
        this.imputedColHeaders.clear();

        const changedElements = this.historyManager.getChangedElements();

        for (const cellPos of changedElements.cells) {
            this.imputedCells.add(`${cellPos.row}-${cellPos.col}`);
        }

        for (const headerPos of changedElements.rowHeaders) {
            this.imputedRowHeaders.add(`${headerPos.headerType}-${headerPos.index}`);
        }

        for (const headerPos of changedElements.colHeaders) {
            this.imputedColHeaders.add(`${headerPos.headerType}-${headerPos.index}`);
        }
    }

    getImputedCells(): Set<string> {
        return new Set(this.imputedCells);
    }

    getImputedRowHeaders(): Set<string> {
        return new Set(this.imputedRowHeaders);
    }

    getImputedColHeaders(): Set<string> {
        return new Set(this.imputedColHeaders);
    }
}
