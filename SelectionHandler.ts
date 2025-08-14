import type {
    GridPosition,
    CellComponent,
    NavigationAnalysis,
    ClickAnalysis,
    HeaderComponent,
} from './types';

// Callback type for selection changes
export type SelectionChangedCallback = (handler: SelectionHandler<any>) => void;

export default class SelectionHandler<TExtraProps = undefined> {
    private selectedCells: Set<string>;
    private cellComponents: Map<string, CellComponent<TExtraProps>>;
    private selections: Selection[];
    private onSelectionsChanged?: SelectionChangedCallback;
    private onDeselectionsChanged?: SelectionChangedCallback;
    private isDeselecting: boolean;
    private deselection: Selection | null;
    private headerComponents: Map<string, HeaderComponent>;
    private selectedHeaders: Set<string>;

    constructor(cellComponents: Map<string, CellComponent<TExtraProps>>,
        headerComponents: Map<string, HeaderComponent>,
        onSelectionsChanged?: SelectionChangedCallback,
        onDeselectionsChanged?: SelectionChangedCallback,
    ) {
        this.selectedCells = new Set<string>();
        this.cellComponents = cellComponents;
        this.selections = [];
        this.onSelectionsChanged = onSelectionsChanged;
        this.onDeselectionsChanged = onDeselectionsChanged;
        this.isDeselecting = false;
        this.deselection = null;
        this.headerComponents = headerComponents;
        this.selectedHeaders = new Set<string>();
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

        // If no changes, do nothing for performance
        if (toDeselect.size === 0 && (!clearPrevious || toSelect.size === 0)) {
            return;
        }

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
        if (analysis.type === 'mousedown' && analysis.modifiers.ctrl && !analysis.modifiers.shift) {
            // CTRL + mousedown: Create new selection or start deselecting
            // Need to adress the the case when the cell is already selected, in that case we deselect cells
            // For now only select case
            if (this.isCellSelected(currentPosition)) {
                this.isDeselecting = true;
                this.createDeselection(anchor, currentPosition);
            } else {
                // Create new selection
                this.addNewSelection(anchor, currentPosition);
            }
        } else if (analysis.type === 'mousedown' && analysis.modifiers.shift && !analysis.modifiers.ctrl) {
            // SHIFT + mousedown: Update active selection
            this.updateActiveSelection(anchor, currentPosition);
        } else if (analysis.type === 'mousedown') {
            // Normal mousedown: First clear and add new selection
            this.clearSelections();
            this.addNewSelection(currentPosition, currentPosition);
        } else if (analysis.type === 'mouseenter') {
            // This whole method is not supposed to be triggered if no changes are detected for position or anchor
            // And in case one of these changes, we update the active selection no matter the modifiers
            if (this.isDeselecting) {
                // If deselecting, update the deselection area
                this.updateDeselection(anchor, currentPosition);
            } else {
                // Otherwise update the active selection
                this.updateActiveSelection(anchor, currentPosition);
            }
        } else if (analysis.type === 'mouseup') {
            // Mouse up: The selections should already be handled by the mouseenter
            // except if the mousedown and mouseup are on the same cell and no modifiers are pressed
            // But in the case of deselection, we finalize it, so skipping this needs to be carefully
            if (anchor.row === currentPosition.row && anchor.col === currentPosition.col &&
                !analysis.modifiers.shift && !analysis.modifiers.ctrl) {
                // If mouse up is on the same cell, we select it
                this.selectSingle(currentPosition);
            }
            if (this.isDeselecting) {
                // If deselecting, finalize deselection
                this.isDeselecting = false;
                this.deselectArea();
                this.clearDeselection();
            }
        }
    }

    // Multiple Selection - Adds new selection, keeps previous ones
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

    // Add multiple individual selections
    addMultipleSelections(positions: GridPosition[]): void {
        positions.forEach(pos => {
            this.addNewSelection(pos, pos);
        });
    }

    // Update Active - Modifies the currently active selection
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

    private deselectArea(): void {
        const deselection = this.getDeselection();
        const newSelections: Selection[] = [];
        if (deselection) {
            for (const selection of this.selections) {
                const newSelection = selection.fragmentExcluding({...deselection.getBounds()});
                newSelections.push(...newSelection);
            }
            this.selections = newSelections;
            // If no active selection remains, set last selection as active
            if (!this.selections.some(sel => sel.isActiveSelection()) && this.selections.length > 0) {
                const lastSelection = this.selections[this.selections.length - 1];
                if (lastSelection) {
                    lastSelection.setActive(true);
                }
            }
            // Update selections with new fragments
            this.syncSelectedCells();
        }
    }

    getSelections(): Selection[] {
        return this.selections;
    }

    // Reuse Selection class for deselection, since it handles rectangular areas
    private createDeselection(position1: GridPosition, position2: GridPosition): void {
        this.deselection = new Selection(position1, position2, false);
        if (this.onDeselectionsChanged) {
            this.onDeselectionsChanged(this);
        }
    }

    private clearDeselection(): void {
        this.deselection = null;
        if (this.onDeselectionsChanged) {
            this.onDeselectionsChanged(this);
        }
    }

    private updateDeselection(position1: GridPosition, position2: GridPosition): void {
        if (this.deselection) {
            this.deselection.updateBounds(position1, position2);
        } else {
            this.createDeselection(position1, position2);
        }
        if (this.onDeselectionsChanged) {
            this.onDeselectionsChanged(this);
        }
    }

    getDeselection(): Selection | null {
        return this.deselection;
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
        this.updateBoundsFromCells(position1, position2);
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
    private calculateBounds(pos1: GridPosition, pos2: GridPosition): { topLeft: GridPosition, bottomRight: GridPosition } {
        const topLeft = {
            row: Math.min(pos1.row, pos2.row),
            col: Math.min(pos1.col, pos2.col)
        };
        const bottomRight = {
            row: Math.max(pos1.row, pos2.row),
            col: Math.max(pos1.col, pos2.col)
        };
        return { topLeft, bottomRight };
    }

    private updateBoundsFromCells(position1: GridPosition, position2: GridPosition): void {
        const { topLeft, bottomRight } = this.calculateBounds(position1, position2);
        this.topLeft = { ...topLeft };
        this.bottomRight = { ...bottomRight };
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

    fragmentExcluding(excludeArea: { topLeft: GridPosition; bottomRight: GridPosition }): Selection[] {
        const fragments: Selection[] = [];

        const selectionTopLeft = this.topLeft;
        const selectionBottomRight = this.bottomRight;

        const excludeTopLeft = excludeArea.topLeft;
        const excludeBottomRight = excludeArea.bottomRight;

        // Calculate intersection
        const intersectTopLeft: GridPosition = {
            row: Math.max(selectionTopLeft.row, excludeTopLeft.row),
            col: Math.max(selectionTopLeft.col, excludeTopLeft.col)
        };

        const intersectBottomRight: GridPosition = {
            row: Math.min(selectionBottomRight.row, excludeBottomRight.row),
            col: Math.min(selectionBottomRight.col, excludeBottomRight.col)
        };

        // Check if there is no intersection
        const noIntersection =
            intersectTopLeft.row > intersectBottomRight.row ||
            intersectTopLeft.col > intersectBottomRight.col;

        if (noIntersection) {
            return [new Selection(selectionTopLeft, selectionBottomRight, this.isActive)];
        }

        // Check if the selection fully covers the intersection area
        const fullCover =
            intersectTopLeft.row === selectionTopLeft.row &&
            intersectBottomRight.row === selectionBottomRight.row &&
            intersectTopLeft.col === selectionTopLeft.col &&
            intersectBottomRight.col === selectionBottomRight.col;

        if (fullCover) {
            return [];
        }

        // Upper part
        if (selectionTopLeft.row < intersectTopLeft.row) {
            fragments.push(new Selection(
                { row: selectionTopLeft.row, col: selectionTopLeft.col },
                { row: intersectTopLeft.row - 1, col: selectionBottomRight.col },
                false
            ));
        }

        // Lower part
        if (intersectBottomRight.row < selectionBottomRight.row) {
            fragments.push(new Selection(
                { row: intersectBottomRight.row + 1, col: selectionTopLeft.col },
                { row: selectionBottomRight.row, col: selectionBottomRight.col },
                false
            ));
        }

        // Left side
        if (selectionTopLeft.col < intersectTopLeft.col) {
            fragments.push(new Selection(
                {
                    row: Math.max(selectionTopLeft.row, intersectTopLeft.row),
                    col: selectionTopLeft.col
                },
                {
                    row: Math.min(selectionBottomRight.row, intersectBottomRight.row),
                    col: intersectTopLeft.col - 1
                },
                false
            ));
        }

        // Right side
        if (intersectBottomRight.col < selectionBottomRight.col) {
            fragments.push(new Selection(
                {
                    row: Math.max(selectionTopLeft.row, intersectTopLeft.row),
                    col: intersectBottomRight.col + 1
                },
                {
                    row: Math.min(selectionBottomRight.row, intersectBottomRight.row),
                    col: selectionBottomRight.col
                },
                false
            ));
        }

        // Set active state for the first fragment if this selection was active
        if (this.isActive && fragments.length > 0) {
            fragments[0].setActive(true);
        }

        return fragments;
    }

}
