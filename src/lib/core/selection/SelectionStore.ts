import type {
    GridPosition,
    CellComponent,
    HeaderComponent,
} from '../types/types.ts';
import { Selection } from './Selection.ts';
import { HeaderSelection } from './HeaderSelection.ts';
import { SelectionSynchronizer } from './SelectionSynchronizer.ts';
import { HeaderReflectionTracker, type HeaderReflectionDiff } from './HeaderReflectionTracker.ts';
import type { DeselectionResult } from './DeselectionManager.ts';
import { positionToKey, keyToPosition } from '../utils/utils.ts';


/**
 * Owns all mutable state for the selection domain — both pure domain state
 * (selections, active selection) and the cross-domain visual state (.selected on
 * component objects). The sole authority for applying mutations to both.
 */
export class SelectionStore<TExtraProps = undefined, TRowHeaderProps = undefined, TColHeaderProps = undefined> {
    // ==================== PURE DOMAIN STATE ====================
    private selections: Selection[] = [];
    private headerSelectionsRows: HeaderSelection[] = [];
    private headerSelectionsCols: HeaderSelection[] = [];
    private activeSelection: Selection | HeaderSelection | null = null;

    // ==================== CROSS-DOMAIN VISUAL STATE ====================
    // Tracking sets — mirror of what is currently .selected on components
    private selectedCells: Set<string> = new Set();
    private selectedRowHeaders: Set<number> = new Set();
    private selectedColHeaders: Set<number> = new Set();

    // Component references — store is the sole mutator of .selected on these
    private cellComponents: Map<string, CellComponent<TExtraProps>>;
    private rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>;
    private colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>;
    private cornerHeaderComponent: HeaderComponent | null;

    private synchronizer: SelectionSynchronizer = new SelectionSynchronizer();
    private headerReflectionTracker: HeaderReflectionTracker = new HeaderReflectionTracker();

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

    // ==================== MUTATIONS ====================

    addSelection(selection: Selection): void {
        this.selections.push(selection);
        this.activeSelection = selection;
    }

    // Factory: constructs a new Selection, registers it, and sets it as active.
    createAndAddSelection(position1: GridPosition, position2: GridPosition): Selection {
        const selection = new Selection(position1, position2);
        this.addSelection(selection);
        return selection;
    }

    // Mutates the bounds of the currently active cell Selection.
    updateActiveCellSelectionBounds(position1: GridPosition, position2: GridPosition): void {
        if (this.activeSelection instanceof Selection) {
            this.activeSelection.updateBounds(position1, position2);
        }
    }

    addHeaderSelection(headerSelection: HeaderSelection, type: 'row' | 'col'): void {
        if (type === 'row') {
            this.headerSelectionsRows.push(headerSelection);
        } else {
            this.headerSelectionsCols.push(headerSelection);
        }
        this.activeSelection = headerSelection;
    }

    // Factory: constructs a new HeaderSelection, registers it, and sets it as active.
    createAndAddHeaderSelection(headerType: 'row' | 'col', anchor: number, pointer: number, gridDimensions: import('../types/types.ts').GridDimensions): HeaderSelection {
        const headerSelection = new HeaderSelection(headerType, anchor, pointer, gridDimensions);
        this.addHeaderSelection(headerSelection, headerType);
        return headerSelection;
    }

    // Mutates the bounds of the currently active HeaderSelection.
    updateActiveHeaderSelectionBounds(anchor: number, pointer: number, gridDimensions: import('../types/types.ts').GridDimensions): void {
        if (this.activeSelection instanceof HeaderSelection) {
            this.activeSelection.updateBoundsWithSync(anchor, pointer, gridDimensions);
        }
    }

    clear(): void {
        this.selections = [];
        this.headerSelectionsRows = [];
        this.headerSelectionsCols = [];
        this.activeSelection = null;
    }

    applyDeselectionResult(result: DeselectionResult): void {
        this.selections = result.selections;
        this.headerSelectionsRows = result.headerSelectionsRows;
        this.headerSelectionsCols = result.headerSelectionsCols;
        this.activeSelection = result.activeSelection;
    }

    // Collects cells from all selections and syncs components. Returns true if anything changed.
    syncCells(): boolean {
        const allCells = new Set<string>();
        this.selections.forEach(s => s.getCells().forEach(c => allCells.add(c)));

        const diff = this.synchronizer.diffCells(this.selectedCells, allCells);
        if (!diff) return false;

        diff.toDeselect.forEach(key => {
            const c = this.cellComponents.get(key);
            if (c) c.selected = false;
        });
        diff.toSelect.forEach(key => {
            const c = this.cellComponents.get(key);
            if (c) c.selected = true;
        });
        this.selectedCells = new Set(allCells);
        return true;
    }

    // Collects header indices from all header selections and syncs components. Returns true if anything changed.
    syncHeaders(): boolean {
        const allRowHeaders = new Set<number>();
        const allColHeaders = new Set<number>();
        this.headerSelectionsRows.forEach(hs => hs.getHeaderIndices().forEach(i => allRowHeaders.add(i)));
        this.headerSelectionsCols.forEach(hs => hs.getHeaderIndices().forEach(i => allColHeaders.add(i)));

        const diff = this.synchronizer.diffHeaders(
            this.selectedRowHeaders, allRowHeaders,
            this.selectedColHeaders, allColHeaders
        );
        if (!diff) return false;

        diff.toDeselectRows.forEach(i => {
            const c = this.getHeaderComponent(`row-${i}`);
            if (c) c.selected = false;
        });
        diff.toSelectRows.forEach(i => {
            const c = this.getHeaderComponent(`row-${i}`);
            if (c) c.selected = true;
        });
        diff.toDeselectCols.forEach(i => {
            const c = this.getHeaderComponent(`col-${i}`);
            if (c) c.selected = false;
        });
        diff.toSelectCols.forEach(i => {
            const c = this.getHeaderComponent(`col-${i}`);
            if (c) c.selected = true;
        });
        this.selectedRowHeaders = new Set(allRowHeaders);
        this.selectedColHeaders = new Set(allColHeaders);
        return true;
    }

    // ==================== QUERIES — PURE DOMAIN ====================

    getSelections(): Selection[] {
        return this.selections;
    }

    getHeaderSelectionsRows(): HeaderSelection[] {
        return this.headerSelectionsRows;
    }

    getHeaderSelectionsCols(): HeaderSelection[] {
        return this.headerSelectionsCols;
    }

    getAllHeaderSelections(): HeaderSelection[] {
        return [...this.headerSelectionsRows, ...this.headerSelectionsCols];
    }

    getActiveSelection(): Selection | HeaderSelection | null {
        return this.activeSelection;
    }

    getActiveSelectionType(): 'cell' | 'header-row' | 'header-col' | null {
        if (this.activeSelection instanceof Selection) return 'cell';
        if (this.activeSelection instanceof HeaderSelection) {
            return this.activeSelection.getDirection() === 'row' ? 'header-row' : 'header-col';
        }
        return null;
    }

    getDerivedCellSelections(): Selection[] {
        return [
            ...this.headerSelectionsRows.map(hs => hs.getCellSelection()),
            ...this.headerSelectionsCols.map(hs => hs.getCellSelection()),
        ];
    }

    // Returns a diff of header reflections since last call, or null if nothing changed.
    getHeaderReflectionDiff(): HeaderReflectionDiff | null {
        return this.headerReflectionTracker.update(this.selections);
    }

    // ==================== QUERIES — SYNCHRONIZER ====================

    getSelectedCells(): Set<string> {
        return new Set(this.selectedCells);
    }

    getSelectedPositions(): GridPosition[] {
        return Array.from(this.selectedCells).map(key => keyToPosition(key));
    }

    isCellSelected(position: GridPosition): boolean {
        return this.selectedCells.has(positionToKey(position));
    }

    isAnyCellSelected(position: GridPosition): boolean {
        const key = positionToKey(position);
        if (this.selectedCells.has(key)) return true;
        for (const hs of this.headerSelectionsRows) {
            if (hs.getCells().has(key)) return true;
        }
        for (const hs of this.headerSelectionsCols) {
            if (hs.getCells().has(key)) return true;
        }
        return false;
    }

    isRowHeaderSelected(index: number): boolean {
        return this.selectedRowHeaders.has(index);
    }

    isColHeaderSelected(index: number): boolean {
        return this.selectedColHeaders.has(index);
    }

    getSelectedHeaders(): Set<string> {
        const all = new Set<string>();
        this.selectedRowHeaders.forEach(i => all.add(`row-${i}`));
        this.selectedColHeaders.forEach(i => all.add(`col-${i}`));
        return all;
    }

    getSelectedRowHeaders(): number[] {
        return Array.from(this.selectedRowHeaders);
    }

    getSelectedColHeaders(): number[] {
        return Array.from(this.selectedColHeaders);
    }

    getAllSelectedCells(): Set<string> {
        const all = new Set(this.selectedCells);
        this.headerSelectionsRows.forEach(hs => hs.getCells().forEach(c => all.add(c)));
        this.headerSelectionsCols.forEach(hs => hs.getCells().forEach(c => all.add(c)));
        return all;
    }

    // ==================== PRIVATE ====================

    private getHeaderComponent(key: string): HeaderComponent<any> | null {
        let c: HeaderComponent<any> | undefined = this.rowHeaderComponents.get(key);
        if (c) return c;
        c = this.colHeaderComponents.get(key);
        if (c) return c;
        if (this.cornerHeaderComponent && key === 'corner') return this.cornerHeaderComponent;
        return null;
    }
}
