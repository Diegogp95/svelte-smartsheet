import type {
    GridPosition,
    CellValue,
} from './types';

// ==================== CELL CHANGE CLASS ====================

export class CellChange {
    constructor(
        public position: GridPosition,
        public oldValue: CellValue,
        public newValue: CellValue
    ) {}

    getPositionKey(): string {
        return `${this.position.row}-${this.position.col}`;
    }

    hasValueChanged(): boolean {
        return this.oldValue !== this.newValue;
    }

    toString(): string {
        return `Cell(${this.position.row},${this.position.col}): ${this.oldValue} → ${this.newValue}`;
    }
}

// ==================== CHANGE SET CLASS ====================

export class ChangeSet {
    constructor(
        public changes: CellChange[],
        public type: 'single-edit' | 'paste' | 'delete' | 'format' | 'other',
        public timestamp: number = Date.now()
    ) {}

    getAffectedPositions(): GridPosition[] {
        return this.changes.map(c => c.position);
    }

    getChangeCount(): number {
        return this.changes.length;
    }

    isSingleCellEdit(): boolean {
        return this.type === 'single-edit' && this.changes.length === 1;
    }

    toString(): string {
        return `ChangeSet(${this.type}): ${this.changes.length} changes at ${new Date(this.timestamp)}`;
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
        console.log(`[HistoryManager] Adding change set with ${changeSet.changes.length} changes (type: ${changeSet.type})`);

        // If we're not at the end of history, remove everything after current position
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
            console.log(`[HistoryManager] Cleared redo history, now at index ${this.currentIndex}`);
        }

        // Add the new change set
        this.history.push(changeSet);
        this.currentIndex = this.history.length - 1;

        // Enforce max history size
        this.enforceMaxSize();

        console.log(`[HistoryManager] History now has ${this.history.length} entries, current index: ${this.currentIndex}`);
    }

    /**
     * Undo the last change
     * Returns the change set to revert, or null if nothing to undo
     */
    undo(): ChangeSet | null {
        if (!this.canUndo()) {
            console.log(`[HistoryManager] Cannot undo: no history available`);
            return null;
        }

        const changeSet = this.history[this.currentIndex];
        this.currentIndex--;

        console.log(`[HistoryManager] Undoing change set, moved to index ${this.currentIndex}`);
        return changeSet;
    }

    /**
     * Redo the next change
     * Returns the change set to reapply, or null if nothing to redo
     */
    redo(): ChangeSet | null {
        if (!this.canRedo()) {
            console.log(`[HistoryManager] Cannot redo: no future history available`);
            return null;
        }

        this.currentIndex++;
        const changeSet = this.history[this.currentIndex];

        console.log(`[HistoryManager] Redoing change set, moved to index ${this.currentIndex}`);
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

        console.log(`[HistoryManager] Clearing history from index ${index}`);
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
        console.log(`[HistoryManager] Max history size set to ${size}`);
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

        console.log(`[HistoryManager] Enforced max size: removed ${entriesToRemove} old entries`);
    }

}
