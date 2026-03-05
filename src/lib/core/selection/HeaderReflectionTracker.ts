import type { Selection } from './Selection.ts';

export interface HeaderReflectionDiff {
    addedRows: Set<number>;
    removedRows: Set<number>;
    addedCols: Set<number>;
    removedCols: Set<number>;
}

export class HeaderReflectionTracker {
    private currentRows: Set<number> = new Set();
    private currentCols: Set<number> = new Set();

    /**
     * Computes which header reflections need to be added or removed based on
     * the current set of regular cell selections. Returns null if nothing changed.
     */
    update(selections: Selection[]): HeaderReflectionDiff | null {
        const { affectedRows, affectedCols } = this.calculateAffected(selections);

        const removedRows = new Set<number>();
        this.currentRows.forEach(row => {
            if (!affectedRows.has(row)) removedRows.add(row);
        });

        const addedRows = new Set<number>();
        affectedRows.forEach(row => {
            if (!this.currentRows.has(row)) addedRows.add(row);
        });

        const removedCols = new Set<number>();
        this.currentCols.forEach(col => {
            if (!affectedCols.has(col)) removedCols.add(col);
        });

        const addedCols = new Set<number>();
        affectedCols.forEach(col => {
            if (!this.currentCols.has(col)) addedCols.add(col);
        });

        if (addedRows.size === 0 && removedRows.size === 0 &&
            addedCols.size === 0 && removedCols.size === 0) {
            return null;
        }

        this.currentRows = new Set(affectedRows);
        this.currentCols = new Set(affectedCols);

        return { addedRows, removedRows, addedCols, removedCols };
    }

    private calculateAffected(selections: Selection[]): { affectedRows: Set<number>, affectedCols: Set<number> } {
        const affectedRows = new Set<number>();
        const affectedCols = new Set<number>();

        selections.forEach(selection => {
            selection.getDerivedRowHeaders().forEach(row => affectedRows.add(row));
            selection.getDerivedColHeaders().forEach(col => affectedCols.add(col));
        });

        return { affectedRows, affectedCols };
    }
}
