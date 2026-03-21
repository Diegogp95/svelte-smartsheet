/**
 * Pure stateless diff engine for selection synchronization.
 * Computes what changed between two selection states without holding references
 * or applying mutations. The Store is responsible for applying all mutations.
 */

export interface CellDiff {
    toSelect: Set<string>;
    toDeselect: Set<string>;
}

export interface HeaderDiff {
    toSelectRows: Set<number>;
    toDeselectRows: Set<number>;
    toSelectCols: Set<number>;
    toDeselectCols: Set<number>;
}

export class SelectionSynchronizer {
    /**
     * Returns the diff between the current and next cell selection sets,
     * or null if nothing changed.
     */
    diffCells(current: Set<string>, next: Set<string>): CellDiff | null {
        const toDeselect = new Set<string>();
        current.forEach(key => { if (!next.has(key)) toDeselect.add(key); });

        const toSelect = new Set<string>();
        next.forEach(key => { if (!current.has(key)) toSelect.add(key); });

        if (toDeselect.size === 0 && toSelect.size === 0) return null;
        return { toSelect, toDeselect };
    }

    /**
     * Returns the diff between the current and next header selection sets,
     * or null if nothing changed.
     */
    diffHeaders(
        currentRows: Set<number>, nextRows: Set<number>,
        currentCols: Set<number>, nextCols: Set<number>
    ): HeaderDiff | null {
        const toDeselectRows = new Set<number>();
        currentRows.forEach(i => { if (!nextRows.has(i)) toDeselectRows.add(i); });

        const toSelectRows = new Set<number>();
        nextRows.forEach(i => { if (!currentRows.has(i)) toSelectRows.add(i); });

        const toDeselectCols = new Set<number>();
        currentCols.forEach(i => { if (!nextCols.has(i)) toDeselectCols.add(i); });

        const toSelectCols = new Set<number>();
        nextCols.forEach(i => { if (!currentCols.has(i)) toSelectCols.add(i); });

        if (toDeselectRows.size === 0 && toSelectRows.size === 0 &&
            toDeselectCols.size === 0 && toSelectCols.size === 0) return null;
        return { toSelectRows, toDeselectRows, toSelectCols, toDeselectCols };
    }
}
