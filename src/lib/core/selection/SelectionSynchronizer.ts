import type {
    CellComponent,
    HeaderComponent,
} from '../types/types.ts';

/**
 * Owns the visual synchronization between domain selection state (sets of indices/keys)
 * and the component objects that carry the `.selected` flag.
 * Encapsulates the diff logic and the component map lookups.
 */
export class SelectionSynchronizer<TExtraProps = undefined, TRowHeaderProps = undefined, TColHeaderProps = undefined> {
    private selectedCells: Set<string> = new Set();
    private selectedRowHeaders: Set<number> = new Set();
    private selectedColHeaders: Set<number> = new Set();

    private cellComponents: Map<string, CellComponent<TExtraProps>>;
    private rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>;
    private colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>;
    private cornerHeaderComponent: HeaderComponent | null;

    constructor(
        cellComponents: Map<string, CellComponent<TExtraProps>>,
        rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>,
        colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>,
        cornerHeaderComponent: HeaderComponent | null
    ) {
        this.cellComponents = cellComponents;
        this.rowHeaderComponents = rowHeaderComponents;
        this.colHeaderComponents = colHeaderComponents;
        this.cornerHeaderComponent = cornerHeaderComponent;
    }

    // ==================== SYNC ====================

    /**
     * Diffs the new cell set against the current one and applies .selected changes
     * to cell components. Returns true if any change was applied.
     */
    syncCells(newCells: Set<string>): boolean {
        const toDeselect = new Set<string>();
        this.selectedCells.forEach(key => {
            if (!newCells.has(key)) toDeselect.add(key);
        });

        const toSelect = new Set<string>();
        newCells.forEach(key => {
            if (!this.selectedCells.has(key)) toSelect.add(key);
        });

        if (toDeselect.size === 0 && toSelect.size === 0) return false;

        toDeselect.forEach(key => {
            const c = this.cellComponents.get(key);
            if (c) c.selected = false;
        });

        toSelect.forEach(key => {
            const c = this.cellComponents.get(key);
            if (c) c.selected = true;
        });

        this.selectedCells = new Set(newCells);
        return true;
    }

    /**
     * Diffs the new header index sets against the current ones and applies .selected
     * changes to header components. Returns true if any change was applied.
     */
    syncHeaders(newRows: Set<number>, newCols: Set<number>): boolean {
        const toDeselectRows = new Set<number>();
        this.selectedRowHeaders.forEach(i => { if (!newRows.has(i)) toDeselectRows.add(i); });

        const toDeselectCols = new Set<number>();
        this.selectedColHeaders.forEach(i => { if (!newCols.has(i)) toDeselectCols.add(i); });

        const toSelectRows = new Set<number>();
        newRows.forEach(i => { if (!this.selectedRowHeaders.has(i)) toSelectRows.add(i); });

        const toSelectCols = new Set<number>();
        newCols.forEach(i => { if (!this.selectedColHeaders.has(i)) toSelectCols.add(i); });

        if (toDeselectRows.size === 0 && toDeselectCols.size === 0 &&
            toSelectRows.size === 0 && toSelectCols.size === 0) return false;

        toDeselectRows.forEach(i => {
            const c = this.getHeaderComponent(`row-${i}`);
            if (c) c.selected = false;
        });
        toDeselectCols.forEach(i => {
            const c = this.getHeaderComponent(`col-${i}`);
            if (c) c.selected = false;
        });
        toSelectRows.forEach(i => {
            const c = this.getHeaderComponent(`row-${i}`);
            if (c) c.selected = true;
        });
        toSelectCols.forEach(i => {
            const c = this.getHeaderComponent(`col-${i}`);
            if (c) c.selected = true;
        });

        this.selectedRowHeaders = new Set(newRows);
        this.selectedColHeaders = new Set(newCols);
        return true;
    }

    // ==================== QUERIES ====================

    isCellSelected(key: string): boolean {
        return this.selectedCells.has(key);
    }

    isRowHeaderSelected(index: number): boolean {
        return this.selectedRowHeaders.has(index);
    }

    isColHeaderSelected(index: number): boolean {
        return this.selectedColHeaders.has(index);
    }

    getSelectedCells(): Set<string> {
        return new Set(this.selectedCells);
    }

    getSelectedRowHeaders(): number[] {
        return Array.from(this.selectedRowHeaders);
    }

    getSelectedColHeaders(): number[] {
        return Array.from(this.selectedColHeaders);
    }

    // ==================== PRIVATE ====================

    private getHeaderComponent(key: string): HeaderComponent<any> | null {
        let c: HeaderComponent<any> | undefined = this.rowHeaderComponents.get(key);
        if (c) return c;

        c = this.colHeaderComponents.get(key);
        if (c) return c;

        if (this.cornerHeaderComponent) {
            const cornerKey = `${this.cornerHeaderComponent.position.headerType}-${this.cornerHeaderComponent.position.index}`;
            if (key === cornerKey) return this.cornerHeaderComponent;
        }

        return null;
    }
}
