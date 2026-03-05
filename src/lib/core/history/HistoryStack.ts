/**
 * Generic bounded undo/redo stack.
 *
 * Completely domain-agnostic — operates only on T.
 * Pushing a new item while the cursor is not at the top discards all
 * entries above the current position (standard undo-tree truncation).
 */
export class HistoryStack<T> {
    private stack: T[] = [];
    private cursor: number = -1; // -1 = empty
    private maxSize: number = 100;

    push(item: T): void {
        // Discard any entries above the current cursor (truncate redo branch)
        if (this.cursor < this.stack.length - 1) {
            this.stack = this.stack.slice(0, this.cursor + 1);
        }
        this.stack.push(item);
        this.cursor = this.stack.length - 1;
        this.enforceMaxSize();
    }

    undo(): T | null {
        if (!this.canUndo()) return null;
        return this.stack[this.cursor--];
    }

    redo(): T | null {
        if (!this.canRedo()) return null;
        return this.stack[++this.cursor];
    }

    canUndo(): boolean {
        return this.cursor >= 0;
    }

    canRedo(): boolean {
        return this.cursor < this.stack.length - 1;
    }

    clear(): void {
        this.stack = [];
        this.cursor = -1;
    }

    clearFrom(index: number): void {
        if (index < 0 || index >= this.stack.length) return;
        this.stack = this.stack.slice(0, index);
        if (this.cursor >= this.stack.length) {
            this.cursor = this.stack.length - 1;
        }
    }

    setMaxSize(size: number): void {
        if (size < 1) {
            console.warn('[HistoryStack] Invalid max size, keeping current');
            return;
        }
        this.maxSize = size;
        this.enforceMaxSize();
    }

    getMaxSize(): number {
        return this.maxSize;
    }

    getCursor(): number {
        return this.cursor;
    }

    getLength(): number {
        return this.stack.length;
    }

    getAt(index: number): T | null {
        if (index < 0 || index >= this.stack.length) return null;
        return this.stack[index];
    }

    private enforceMaxSize(): void {
        if (this.stack.length <= this.maxSize) return;
        const toRemove = this.stack.length - this.maxSize;
        this.stack = this.stack.slice(toRemove);
        this.cursor = Math.max(-1, this.cursor - toRemove);
    }
}
