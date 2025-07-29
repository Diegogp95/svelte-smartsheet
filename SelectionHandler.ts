import { t } from 'svelte-i18n';
import type {
    GridPosition,
    CellComponent,
    NavigationAnalysis,
    ClickAnalysis,
} from './types';

// Callback type for selection changes
export type SelectionChangedCallback = (handler: SelectionHandler) => void;

export default class SelectionHandler {
    private selectedCells: Set<string>;
    private cellComponents: Map<string, CellComponent>;
    private selections: Selection[];
    private onSelectionsChanged?: (handler: SelectionHandler) => void;

    constructor(cellComponents: Map<string, CellComponent>, onSelectionsChanged?: (handler: SelectionHandler) => void) {
        this.selectedCells = new Set<string>();
        this.cellComponents = cellComponents;
        this.selections = [];
        this.onSelectionsChanged = onSelectionsChanged;
    }

    // Helper method to convert position to key
    private positionToKey(position: GridPosition): string {
        return `${position.row}-${position.col}`;
    }

    // Helper method to convert key to position
    private keyToPosition(key: string): GridPosition {
        const [row, col] = key.split('-').map(Number);
        return { row, col };
    }

    // Efficient update: only changes cells that actually changed state
    updateSelection(newSelection: Set<string>, clearPrevious: boolean = true) {
        let finalSelection: Set<string>;

        if (clearPrevious) {
            finalSelection = new Set(newSelection);
        } else {
            finalSelection = new Set([...this.selectedCells, ...newSelection]);
        }

        const toDeselect = new Set<string>();
        this.selectedCells.forEach(key => {
            if (!finalSelection.has(key)) {
                toDeselect.add(key);
            }
        });

        const toSelect = new Set<string>();
        finalSelection.forEach(key => {
            if (!this.selectedCells.has(key)) {
                toSelect.add(key);
            }
        });

        // Update selectedCells state
        this.applyCellChanges(toDeselect, toSelect);
        this.selectedCells = finalSelection;

        // Emit change event if a handler is set
        if (this.onSelectionsChanged) {
            this.onSelectionsChanged(this);
        }
    }

    // Apply visual changes to Cell components
    private applyCellChanges(toDeselect: Set<string>, toSelect: Set<string>) {
        // Deselect specific cells
        toDeselect.forEach(key => {
            const cellComponent = this.cellComponents.get(key);
            if (cellComponent) {
                cellComponent.setSelected(false);
            }
        });

        // Select specific cells
        toSelect.forEach(key => {
            const cellComponent = this.cellComponents.get(key);
            if (cellComponent) {
                cellComponent.setSelected(true);
            }
        });
    }

    clearSelections() {
        this.selections = [];
        this.updateSelection(new Set());
    }

    // Getters
    getSelectedCells(): Set<string> {
        return new Set(this.selectedCells);
    }

    getSelectedPositions(): GridPosition[] {
        return Array.from(this.selectedCells).map(key => this.keyToPosition(key));
    }

    isCellSelected(position: GridPosition): boolean {
        const key = this.positionToKey(position);
        return this.selectedCells.has(key);
    }

    // Process keyboard navigation selection with modifiers
    processNavigationSelection(analysis: NavigationAnalysis, currentPosition: GridPosition, anchor: GridPosition): void {
        if (analysis.modifiers.shift) {
            // SHIFT + Arrow (con o sin Ctrl): Update active selection
            this.updateActiveSelection(anchor, currentPosition);
        } else {
            // Normal Arrow o Ctrl+Arrow: Single selection
            this.selectSingle(currentPosition);
        }
    }

    // Process mouse click selection with modifiers
    processClickSelection(analysis: ClickAnalysis, currentPosition: GridPosition, anchor: GridPosition): void {
        if (analysis.modifiers.ctrl && analysis.modifiers.shift) {
            // SHIFT + CTRL + Click: Single selection (comportamiento Excel)
            this.selectSingle(currentPosition);
        } else if (analysis.modifiers.ctrl) {
            // CTRL + Click: Add new selection (multiple)
            this.addNewSelection(anchor, currentPosition);
        } else if (analysis.modifiers.shift && anchor) {
            // SHIFT + Click: Update active selection
            this.updateActiveSelection(anchor, currentPosition);
        } else {
            // Normal Click: Single selection
            this.selectSingle(currentPosition);
        }
    }

    // NUEVO: Multiple Selection - Añade nueva selección, mantiene anteriores
    private addNewSelection(position1: GridPosition, position2: GridPosition): void {
        // Create new selection without affecting existing ones
        this.createSelection(position1, position2);
        // Sync selected cells after adding new selection
        this.syncSelectedCells();
    }

    selectSingle(position: GridPosition): void {
        this.clearSelections();
        this.addNewSelection(position, position);
    }

    // NUEVO: Update Active - Modifica la selección activa existente
    private updateActiveSelection(position1: GridPosition, position2: GridPosition): void {
        const activeSelection = this.getActiveSelection();
        if (activeSelection) {
            // Update existing active selection
            activeSelection.updateBounds(position1, position2);
        } else {
            // No active selection, create a new one
            this.createSelection(position1, position2);
        }
        // Sync selected cells after updating active selection
        this.syncSelectedCells();
    }

    // Get the currently active selection
    private getActiveSelection(): Selection | undefined {
        return this.selections.find(selection => selection.isActiveSelection());
    }

    // Create a new selection and add it to the list
    private createSelection(position1: GridPosition, position2: GridPosition): Selection {
        // Deactivate all previous selections
        this.selections.forEach(sel => sel.setActive(false));

        // Create new selection as active
        const newSelection = new Selection(position1, position2, true);
        this.selections.push(newSelection);

        return newSelection;
    }

    // Get current position from navigation handler
    private syncSelectedCells(): void {
        const allCells = new Set<string>();

        // Collect all cells from current selections
        this.selections.forEach(selection => {
            selection.getCells().forEach(cell => allCells.add(cell));
        });

        // Usar updateSelection existente para manejar cambios visuales
        this.updateSelection(allCells, true);
    }

    findSelectionsContaining(position: GridPosition): Selection[] {
        return this.selections.filter(selection => selection.contains(position));
    }

    deselectArea(position1: GridPosition, position2: GridPosition): void {
        // TODO: For each selection that contains the area:
        // 1. Fragment the selection excluding the area
        // 2. Replace the original selection with the fragments
        // 3. Sync selected cells after modification
    }

    // Process area toggle: select or deselect based on current state
    processAreaToggle(position1: GridPosition, position2: GridPosition): void {
        const selectionsAtStart = this.findSelectionsContaining(position1);

        if (selectionsAtStart.length > 0) {
            // If first cell is selected, deselect area
            this.deselectArea(position1, position2);
        } else {
            // First cell is not selected → select area (additive)
            this.addNewSelection(position1, position2);
        }
    }

    getSelections(): Selection[] {
        return this.selections;
    }
}

export class Selection {
    // Rectangular selection defined by two corners
    private topLeft!: GridPosition;
    private bottomRight!: GridPosition;

    // Set of cells in this selection
    private cells: Set<string>;

    // Active state of the selection
    private isActive: boolean;

    // Timestamp of creation
    private createdAt: number;

    // Grid area for CSS grid layout
    private gridArea!: {
        rowStart: number;
        rowEnd: number;
        colStart: number; 
        colEnd: number;
    };

    constructor(
        position1: GridPosition,
        position2: GridPosition,
        isActive: boolean = true
    ) {
        this.isActive = isActive;
        this.createdAt = Date.now();
        this.cells = new Set<string>();
        
        // Calculate bounds and grid area
        this.updateBounds(position1, position2);
    }

    // Update selection bounds and recalculate cells
    updateBounds(position1: GridPosition, position2: GridPosition): void {
        this.calculateBounds(position1, position2);
        this.recalculateCells();
        this.updateGridArea();
    }

    contains(position: GridPosition): boolean {
        const key = this.positionToKey(position);
        return this.cells.has(key);
    }

    getCells(): Set<string> {
        return new Set(this.cells);
    }

    getBounds(): { topLeft: GridPosition, bottomRight: GridPosition } {
        return {
            topLeft: { ...this.topLeft },
            bottomRight: { ...this.bottomRight }
        };
    }

    getGridArea(): { rowStart: number, rowEnd: number, colStart: number, colEnd: number } {
        return { ...this.gridArea };
    }

    setActive(active: boolean): void {
        this.isActive = active;
    }

    isActiveSelection(): boolean {
        return this.isActive;
    }

    getCreatedAt(): number {
        return this.createdAt;
    }

    // Calculate bounds based on two positions
    private calculateBounds(pos1: GridPosition, pos2: GridPosition): void {
        this.topLeft = {
            row: Math.min(pos1.row, pos2.row),
            col: Math.min(pos1.col, pos2.col)
        };
        this.bottomRight = {
            row: Math.max(pos1.row, pos2.row),
            col: Math.max(pos1.col, pos2.col)
        };
    }

    private recalculateCells(): void {
        this.cells.clear();

        for (let row = this.topLeft.row; row <= this.bottomRight.row; row++) {
            for (let col = this.topLeft.col; col <= this.bottomRight.col; col++) {
                this.cells.add(this.positionToKey({ row, col }));
            }
        }
    }

    private updateGridArea(): void {
        // Grid area is 1-based for CSS grid, so we add 1 to each index
        this.gridArea = {
            rowStart: this.topLeft.row + 1,
            rowEnd: this.bottomRight.row + 2, // +2 because end is exclusive
            colStart: this.topLeft.col + 1,
            colEnd: this.bottomRight.col + 2
        };
    }

    private positionToKey(position: GridPosition): string {
        return `${position.row}-${position.col}`;
    }

    fragmentExcluding(excludeArea: { topLeft: GridPosition, bottomRight: GridPosition }): Selection[] {
        // TODO: Calculate resulting rectangles (can be 0-8 new rectangles)
        // If this selection was active, mark one of the new ones as active
        return []; // Placeholder
    }
}
