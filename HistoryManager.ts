import type {
    GridPosition,
    CellValue,
    HeaderPosition,
    HeaderValue,
} from './types';

// ==================== CELL CHANGE CLASS ====================

export class CellChange {
    constructor(
        public position: GridPosition,
        public oldValue: CellValue,
        public newValue: CellValue
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

// ==================== HEADER CHANGE CLASS ====================

export class HeaderChange {
    constructor(
        public position: HeaderPosition,
        public oldValue: HeaderValue,
        public newValue: HeaderValue
    ) {}

    getType(): 'header' {
        return 'header';
    }

    getPositionKey(): string {
        return `header-${this.position.headerType}-${this.position.index}`;
    }

    hasValueChanged(): boolean {
        return this.oldValue !== this.newValue;
    }

    toString(): string {
        return `Header(${this.position.headerType}[${this.position.index}]): ${this.oldValue} → ${this.newValue}`;
    }
}

// ==================== CHANGE SET CLASS ====================

export class ChangeSet {
    constructor(
        public changes: CellChange[] | HeaderChange[],
        public type: 'single-edit' | 'paste' | 'delete' | 'format' | 'other',
        public timestamp: number = Date.now()
    ) {}

    getAffectedPositions(): (GridPosition | HeaderPosition)[] {
        return this.changes.map(c => c.position);
    }

    getCellPositions(): GridPosition[] {
        if (this.isCellOnlyEdit()) {
            return (this.changes as CellChange[]).map(c => c.position);
        }
        return [];
    }

    getHeaderPositions(): HeaderPosition[] {
        if (this.isHeaderOnlyEdit()) {
            return (this.changes as HeaderChange[]).map(c => c.position);
        }
        return [];
    }

    getChangeCount(): number {
        return this.changes.length;
    }

    isSingleCellEdit(): boolean {
        return this.type === 'single-edit' &&
               this.changes.length === 1 &&
               this.isCellOnlyEdit();
    }

    isSingleHeaderEdit(): boolean {
        return this.type === 'single-edit' &&
               this.changes.length === 1 &&
               this.isHeaderOnlyEdit();
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
            // Empty changeset
            return `ChangeSet(${this.type}): 0 changes at ${new Date(this.timestamp)}`;
        }
    }
}

// ==================== HISTORY MANAGER CLASS ====================

export class HistoryManager {
    private history: ChangeSet[] = [];
    private currentIndex: number = -1; // -1 means no history, 0+ means position in history
    private maxHistorySize: number = 100; // Default limit

    /**
     * Add a new change set to history
     * This clears any "redo" history if we're not at the end
     */
    add(changeSet: ChangeSet): void {

        // If we're not at the end of history, remove everything after current position
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }

        // Add the new change set
        this.history.push(changeSet);
        this.currentIndex = this.history.length - 1;

        // Enforce max history size
        this.enforceMaxSize();
    }

    /**
     * Undo the last change
     * Returns the change set to revert, or null if nothing to undo
     */
    undo(): ChangeSet | null {
        if (!this.canUndo()) {
            return null;
        }

        const changeSet = this.history[this.currentIndex];
        this.currentIndex--;

        return changeSet;
    }

    /**
     * Redo the next change
     * Returns the change set to reapply, or null if nothing to redo
     */
    redo(): ChangeSet | null {
        if (!this.canRedo()) {
            return null;
        }

        this.currentIndex++;
        const changeSet = this.history[this.currentIndex];

        return changeSet;
    }

    /**
     * Check if undo is possible
     */
    canUndo(): boolean {
        return this.currentIndex >= 0;
    }

    /**
     * Check if redo is possible
     */
    canRedo(): boolean {
        return this.currentIndex < this.history.length - 1;
    }

    /**
     * Get current position in history
     */
    getCurrentIndex(): number {
        return this.currentIndex;
    }

    /**
     * Get total history length
     */
    getHistoryLength(): number {
        return this.history.length;
    }

    /**
     * Get change set at specific index
     */
    getChangeAt(index: number): ChangeSet | null {
        if (index < 0 || index >= this.history.length) {
            return null;
        }
        return this.history[index];
    }

    /**
     * Clear all history
     */
    clear(): void {
        console.log(`[HistoryManager] Clearing all history`);
        this.history = [];
        this.currentIndex = -1;
    }

    /**
     * Clear history from a specific point onwards
     */
    clearFrom(index: number): void {
        if (index < 0 || index >= this.history.length) {
            return;
        }

        this.history = this.history.slice(0, index);

        // Adjust current index if it's beyond the new end
        if (this.currentIndex >= this.history.length) {
            this.currentIndex = this.history.length - 1;
        }
    }

    /**
     * Set maximum history size
     */
    setMaxHistorySize(size: number): void {
        if (size < 1) {
            console.warn(`[HistoryManager] Invalid max size: ${size}, keeping current size`);
            return;
        }

        this.maxHistorySize = size;
        this.enforceMaxSize();
    }

    /**
     * Get maximum history size
     */
    getMaxHistorySize(): number {
        return this.maxHistorySize;
    }

    /**
     * Enforce maximum history size by removing oldest entries
     */
    private enforceMaxSize(): void {
        if (this.history.length <= this.maxHistorySize) {
            return;
        }

        const entriesToRemove = this.history.length - this.maxHistorySize;
        this.history = this.history.slice(entriesToRemove);
        this.currentIndex = Math.max(-1, this.currentIndex - entriesToRemove);
    }

    /**
     * Get all changed cells across the entire history
     * @returns Array of GridPosition for cells that have been changed
     */
    getChangedCells(): GridPosition[] {
        const changedCells: Set<GridPosition> = new Set();

        for (const changeSet of this.history) {
            if (changeSet.isCellOnlyEdit()) {
                for (const change of changeSet.changes as CellChange[]) {
                    changedCells.add(change.position);
                }
            }
        }
        return Array.from(changedCells);
    }

}
