import type {
    GridPosition,
    HeaderPosition,
    CellComponent,
    NavigationAnalysis,
    HeaderComponent,
    MouseEventAnalysis,
    NavigationAnchorsAndPointers,
    GridDimensions,
} from './types';


// Callback type for selection changes
export type SelectionChangedCallback = (handler: SelectionHandler<any, any, any>) => void;

export default class SelectionHandler<TExtraProps = undefined, TRowHeaderProps = undefined, TColHeaderProps = undefined> {
    private selectedCells: Set<string>;
    private cellComponents: Map<string, CellComponent<TExtraProps>>;
    private selections: Selection[];
    private onSelectionsChanged?: SelectionChangedCallback;
    private onDeselectionsChanged?: SelectionChangedCallback;
    private isDeselecting: boolean;
    private deselection: Selection | null;
    private headerDeselection: HeaderSelection | null;
    // Separate header components by type
    private rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>;
    private colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>;
    private cornerHeaderComponent: HeaderComponent | null;
    private selectedRowHeaders: Set<number>;
    private selectedColHeaders: Set<number>;
    private headerSelectionsRows: HeaderSelection[];
    private headerSelectionsCols: HeaderSelection[];
    private gridDimensions: GridDimensions;

    constructor(
        gridDimensions: GridDimensions,
        cellComponents: Map<string, CellComponent<TExtraProps>>,
        rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>,
        colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>,
        cornerHeaderComponent: HeaderComponent | null,
        onSelectionsChanged?: SelectionChangedCallback,
        onDeselectionsChanged?: SelectionChangedCallback,
    ) {
        this.gridDimensions = gridDimensions;
        this.selectedCells = new Set<string>();
        this.cellComponents = cellComponents;
        this.selections = [];
        this.onSelectionsChanged = onSelectionsChanged;
        this.onDeselectionsChanged = onDeselectionsChanged;
        this.isDeselecting = false;
        this.deselection = null;
        this.headerDeselection = null;
        this.rowHeaderComponents = rowHeaderComponents;
        this.colHeaderComponents = colHeaderComponents;
        this.cornerHeaderComponent = cornerHeaderComponent;
        this.selectedRowHeaders = new Set<number>();
        this.selectedColHeaders = new Set<number>();
        this.headerSelectionsRows = [];
        this.headerSelectionsCols = [];
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

    // Efficient header update: only changes headers that actually changed state
    updateHeaderSelections(newRowHeaders: Set<number>, newColHeaders: Set<number>, clearPrevious: boolean = true) {
        let finalRowHeaders: Set<number>;
        let finalColHeaders: Set<number>;

        if (clearPrevious) {
            finalRowHeaders = new Set(newRowHeaders);
            finalColHeaders = new Set(newColHeaders);
        } else {
            finalRowHeaders = new Set([...this.selectedRowHeaders, ...newRowHeaders]);
            finalColHeaders = new Set([...this.selectedColHeaders, ...newColHeaders]);
        }

        const toDeselectRows = new Set<number>();
        this.selectedRowHeaders.forEach(index => {
            if (!finalRowHeaders.has(index)) {
                toDeselectRows.add(index);
            }
        });

        const toDeselectCols = new Set<number>();
        this.selectedColHeaders.forEach(index => {
            if (!finalColHeaders.has(index)) {
                toDeselectCols.add(index);
            }
        });

        const toSelectRows = new Set<number>();
        finalRowHeaders.forEach(index => {
            if (!this.selectedRowHeaders.has(index)) {
                toSelectRows.add(index);
            }
        });

        const toSelectCols = new Set<number>();
        finalColHeaders.forEach(index => {
            if (!this.selectedColHeaders.has(index)) {
                toSelectCols.add(index);
            }
        });

        // If no changes, do nothing for performance
        if (toDeselectRows.size === 0 && toDeselectCols.size === 0 &&
            (!clearPrevious || (toSelectRows.size === 0 && toSelectCols.size === 0))) {
            return;
        }

        // Update selectedHeaders state
        this.applyHeaderChanges(toDeselectRows, toDeselectCols, toSelectRows, toSelectCols);
        this.selectedRowHeaders = finalRowHeaders;
        this.selectedColHeaders = finalColHeaders;

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
                cellComponent.selected = false;
            }
        });

        // Select specific cells
        toSelect.forEach(key => {
            const cellComponent = this.cellComponents.get(key);
            if (cellComponent) {
                cellComponent.selected = true;
            }
        });
    }

    clearSelections() {
        this.selections = [];
        this.headerSelectionsRows = [];
        this.headerSelectionsCols = [];
        this.updateSelection(new Set());
        this.updateHeaderSelections(new Set<number>(), new Set<number>());
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

    // Excel-like behavior: Check if a cell is selected either directly or through header selections (on-demand)
    isAnyCellSelected(position: GridPosition): boolean {
        // First check direct cell selection
        if (this.isCellSelected(position)) {
            return true;
        }

        // Then check if cell is covered by any header selection (on-demand calculation)
        const key = this.positionToKey(position);

        // Check row header selections
        for (const headerSelection of this.headerSelectionsRows) {
            if (headerSelection.getCells().has(key)) {
                return true;
            }
        }

        // Check column header selections
        for (const headerSelection of this.headerSelectionsCols) {
            if (headerSelection.getCells().has(key)) {
                return true;
            }
        }

        return false;
    }

    // Get all selected cells combining direct selections and header-derived selections (on-demand)
    getAllSelectedCells(): Set<string> {
        const allCells = new Set<string>();

        // Add directly selected cells
        this.selectedCells.forEach(cell => allCells.add(cell));

        // Add cells from row header selections
        this.headerSelectionsRows.forEach(headerSelection => {
            headerSelection.getCells().forEach(cell => allCells.add(cell));
        });

        // Add cells from column header selections
        this.headerSelectionsCols.forEach(headerSelection => {
            headerSelection.getCells().forEach(cell => allCells.add(cell));
        });

        return allCells;
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

    // Process mouse selection based on new action system
    processMouseSelection(analysis: MouseEventAnalysis, navigationState: NavigationAnchorsAndPointers): void {
        const { selectionAction, componentType, draggingContext } = analysis;

        // Extract current position and anchor from navigation state for backward compatibility
        const currentPosition = navigationState.cellPointer;
        const anchor = navigationState.cellAnchor;

        // Switch case based on selection action
        switch (selectionAction) {
            case 'new-selection':
                // Clear existing selections and create new single selection
                this.clearSelections();

                if (componentType === 'header') {
                    // Header selection: use header-specific processing
                    const headerPos = analysis.position as HeaderPosition;
                    this.processNewHeaderSelection(headerPos, navigationState);
                } else {
                    // Cell selection: use existing method with cell anchors and pointers
                    this.addNewSelection(anchor, currentPosition);
                }
                break;

            case 'add-selection':
                // CTRL+mousedown: Add to multi-selection or start deselecting
                if (componentType === 'header') {
                    // Header selection: check if header is already selected
                    const headerPos = analysis.position as HeaderPosition;

                    // Skip corner headers for now
                    if (headerPos.headerType === 'corner') {
                        break;
                    }

                    if (this.isHeaderSelected(headerPos.headerType, headerPos.index)) {
                        // Header is already selected, start deselecting headers
                        this.isDeselecting = true;
                        if (headerPos.headerType === 'row') {
                            this.createHeaderDeselection('row', navigationState.headerAnchorRow, navigationState.headerPointerRow);
                        } else if (headerPos.headerType === 'col') {
                            this.createHeaderDeselection('col', navigationState.headerAnchorCol, navigationState.headerPointerCol);
                        }
                    } else {
                        // Header not selected, add to multi-selection
                        if (headerPos.headerType === 'row') {
                            this.addNewHeaderSelection('row', navigationState.headerAnchorRow, navigationState.headerPointerRow);
                        } else if (headerPos.headerType === 'col') {
                            this.addNewHeaderSelection('col', navigationState.headerAnchorCol, navigationState.headerPointerCol);
                        }
                    }
                } else {
                    // Cell selection: Excel-like behavior - check both direct and header-derived selections
                    if (this.isAnyCellSelected(currentPosition)) {
                        // Cell is selected (directly or through headers), start deselecting
                        this.isDeselecting = true;
                        this.createDeselection(anchor, currentPosition);
                    } else {
                        // Create new selection, keep existing ones
                        this.addNewSelection(anchor, currentPosition);
                    }
                }
                break;

            case 'update-selection':
                // Update active selection (drag continues or shift+mousedown)
                if (this.isDeselecting) {
                    // Determine if we're deselecting headers or cells
                    if (this.headerDeselection !== null) {
                        // Header deselection active - update header deselection area
                        const headerType = this.headerDeselection.getDirection();

                        if (headerType === 'row') {
                            this.updateHeaderDeselection('row', navigationState.headerAnchorRow, navigationState.headerPointerRow);
                        } else if (headerType === 'col') {
                            this.updateHeaderDeselection('col', navigationState.headerAnchorCol, navigationState.headerPointerCol);
                        }
                    } else {
                        // Cell deselection active - use existing logic
                        this.updateDeselection(anchor, currentPosition);
                    }
                } else {
                    // Normal selection active - use dragging context to determine initial context
                    if (draggingContext.dragType === 'row' || draggingContext.dragType === 'col') {
                        // Header selection context - update active header selection
                        const headerType = draggingContext.dragType as 'row' | 'col';

                        if (headerType === 'row') {
                            this.updateActiveHeaderSelection('row', navigationState.headerAnchorRow, navigationState.headerPointerRow);
                        } else if (headerType === 'col') {
                            this.updateActiveHeaderSelection('col', navigationState.headerAnchorCol, navigationState.headerPointerCol);
                        }
                    } else {
                        // Cell selection context - use existing logic
                        this.updateActiveSelection(anchor, currentPosition);
                    }
                }
                break;

            case 'finalize-selection':
                // Mouseup: Finalize current selection state
                // Finalize deselection if active
                if (this.isDeselecting) {
                    this.isDeselecting = false;

                    // Determine what type of deselection to finalize
                    if (this.headerDeselection !== null) {
                        // Finalize header deselection
                        this.deselectHeaderArea();
                        this.clearHeaderDeselection();
                    } else if (this.deselection !== null) {
                        // Finalize cell deselection
                        this.deselectArea();
                        this.clearDeselection();
                    }
                }
                // No additional actions needed for normal selection finalization (mouseup without deselection)
                break;

            case 'clear':
                // Clear selection
                this.clearSelections();
                break;

            case 'none':
                // No selection action needed
                break;

            default:
                // Unknown action - log for debugging
                console.warn('Unknown selection action:', selectionAction);
                break;
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

    // Get the currently active header selection (any type)
    private getActiveHeaderSelection(): HeaderSelection | undefined {
        // Check row headers first
        const activeRowHeader = this.headerSelectionsRows.find(selection => selection.isActiveSelection());
        if (activeRowHeader) return activeRowHeader;

        // Then check column headers
        const activeColHeader = this.headerSelectionsCols.find(selection => selection.isActiveSelection());
        return activeColHeader;
    }

    // Get the currently active header selection of specific type
    private getActiveHeaderSelectionByType(headerType: 'row' | 'col'): HeaderSelection | undefined {
        const headerSelections = headerType === 'row' ? this.headerSelectionsRows : this.headerSelectionsCols;
        return headerSelections.find(selection => selection.isActiveSelection());
    }

    // Check if a header is selected (by type and index)
    private isHeaderSelected(headerType: 'row' | 'col', index: number): boolean {
        if (headerType === 'row') {
            return this.selectedRowHeaders.has(index);
        } else {
            return this.selectedColHeaders.has(index);
        }
    }

    // Update Active Header Selection - Modifies the currently active header selection
    private updateActiveHeaderSelection(headerType: 'row' | 'col', anchor: number, pointer: number): void {
        const activeHeaderSelection = this.getActiveHeaderSelectionByType(headerType);
        if (activeHeaderSelection) {
            // Update existing active header selection
            activeHeaderSelection.updateBoundsWithSync(anchor, pointer, this.gridDimensions);
        } else {
            // No active header selection of this type, create a new one
            this.createHeaderSelection(headerType, anchor, pointer);
        }
        // Sync selected headers after updating active selection
        this.syncSelectedHeaders();
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

        // Update visual representation of selected cells
        this.updateSelection(allCells, true);
    }

    private deselectArea(): void {
        const deselection = this.getDeselection();
        if (!deselection) return;

        const deselectionBounds = deselection.getBounds();
        const newSelections: Selection[] = [];
        const newRowHeaderSelections: HeaderSelection[] = [];
        const newColHeaderSelections: HeaderSelection[] = [];

        // 1. Fragment regular cell selections (existing behavior)
        for (const selection of this.selections) {
            const fragments = selection.fragmentExcluding(deselectionBounds);
            newSelections.push(...fragments);
        }

        // 2. Process row header selections (NEW: Excel-like behavior)
        for (const headerSelection of this.headerSelectionsRows) {
            const cellSelection = headerSelection.getCellSelection();
            const cellFragments = cellSelection.fragmentExcluding(deselectionBounds);

            if (cellFragments.length === 0) {
                // HeaderSelection completely covered → remove (don't add to new array)
                // No action needed, headerSelection will be garbage collected
            } else if (cellFragments.length === 1) {
                // Check if bounds are identical (not affected)
                const originalBounds = cellSelection.getBounds();
                const fragmentBounds = cellFragments[0].getBounds();
                const isUnaffected =
                    originalBounds.topLeft.row === fragmentBounds.topLeft.row &&
                    originalBounds.topLeft.col === fragmentBounds.topLeft.col &&
                    originalBounds.bottomRight.row === fragmentBounds.bottomRight.row &&
                    originalBounds.bottomRight.col === fragmentBounds.bottomRight.col;

                if (isUnaffected) {
                    // HeaderSelection NOT affected → keep as HeaderSelection
                    newRowHeaderSelections.push(headerSelection);
                } else {
                    // HeaderSelection partially affected → convert fragment to regular Selection
                    newSelections.push(...cellFragments);
                }
            } else {
                // HeaderSelection partially affected → convert fragments to regular Selections
                newSelections.push(...cellFragments);
            }
        }

        // 3. Process column header selections (same algorithm as row headers)
        for (const headerSelection of this.headerSelectionsCols) {
            const cellSelection = headerSelection.getCellSelection();
            const cellFragments = cellSelection.fragmentExcluding(deselectionBounds);

            if (cellFragments.length === 0) {
                // HeaderSelection completely covered → remove (don't add to new array)
                // No action needed, headerSelection will be garbage collected
            } else if (cellFragments.length === 1) {
                // Check if bounds are identical (not affected)
                const originalBounds = cellSelection.getBounds();
                const fragmentBounds = cellFragments[0].getBounds();
                const isUnaffected =
                    originalBounds.topLeft.row === fragmentBounds.topLeft.row &&
                    originalBounds.topLeft.col === fragmentBounds.topLeft.col &&
                    originalBounds.bottomRight.row === fragmentBounds.bottomRight.row &&
                    originalBounds.bottomRight.col === fragmentBounds.bottomRight.col;

                if (isUnaffected) {
                    // HeaderSelection NOT affected → keep as HeaderSelection
                    newColHeaderSelections.push(headerSelection);
                } else {
                    // HeaderSelection partially affected → convert fragment to regular Selection
                    newSelections.push(...cellFragments);
                }
            } else {
                // HeaderSelection partially affected → convert fragments to regular Selections
                newSelections.push(...cellFragments);
            }
        }

        // 4. Update all selection arrays (eliminates affected HeaderSelections by omission)
        this.selections = newSelections;
        this.headerSelectionsRows = newRowHeaderSelections;
        this.headerSelectionsCols = newColHeaderSelections;

        // 5. Maintain active state and synchronize visual representation
        const allSelections = [...this.selections, ...this.headerSelectionsRows, ...this.headerSelectionsCols];
        if (!allSelections.some(sel => sel.isActiveSelection()) && allSelections.length > 0) {
            const lastSelection = allSelections[allSelections.length - 1];
            if (lastSelection) {
                lastSelection.setActive(true);
            }
        }

        // Update visual state for both cells and headers
        this.syncSelectedCells();
        this.syncSelectedHeaders();
    }

    getSelections(): Selection[] {
        return this.selections;
    }

    // Get current row header selections
    getHeaderSelectionsRows(): HeaderSelection[] {
        return this.headerSelectionsRows;
    }

    // Get current column header selections
    getHeaderSelectionsCols(): HeaderSelection[] {
        return this.headerSelectionsCols;
    }

    // Get all header selections (both rows and columns)
    getAllHeaderSelections(): HeaderSelection[] {
        return [...this.headerSelectionsRows, ...this.headerSelectionsCols];
    }

    // Get derived cell selections from header selections (for visualization)
    getDerivedCellSelections(): Selection[] {
        const derivedSelections: Selection[] = [];

        // Add cell selections from row header selections
        this.headerSelectionsRows.forEach(headerSelection => {
            // Each HeaderSelection has an internal cellSelection that represents the derived cells
            derivedSelections.push(headerSelection.getCellSelection());
        });

        // Add cell selections from column header selections
        this.headerSelectionsCols.forEach(headerSelection => {
            // Each HeaderSelection has an internal cellSelection that represents the derived cells
            derivedSelections.push(headerSelection.getCellSelection());
        });

        return derivedSelections;
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

    getHeaderDeselection(): HeaderSelection | null {
        return this.headerDeselection;
    }

    // Header deselection methods (similar to cell deselection)
    private createHeaderDeselection(headerType: 'row' | 'col', anchor: number, pointer: number): void {
        this.headerDeselection = new HeaderSelection(headerType, anchor, pointer, this.gridDimensions, false);
        if (this.onDeselectionsChanged) {
            this.onDeselectionsChanged(this);
        }
    }

    private clearHeaderDeselection(): void {
        this.headerDeselection = null;
        if (this.onDeselectionsChanged) {
            this.onDeselectionsChanged(this);
        }
    }

    private updateHeaderDeselection(headerType: 'row' | 'col', anchor: number, pointer: number): void {
        if (this.headerDeselection && this.headerDeselection.getDirection() === headerType) {
            this.headerDeselection.updateBoundsWithSync(anchor, pointer, this.gridDimensions);
        } else {
            this.createHeaderDeselection(headerType, anchor, pointer);
        }
        if (this.onDeselectionsChanged) {
            this.onDeselectionsChanged(this);
        }
    }

    private deselectHeaderArea(): void {
        const headerDeselection = this.getHeaderDeselection();
        if (!headerDeselection) return;

        const headerType = headerDeselection.getDirection();
        const cellDeselectionBounds = headerDeselection.getCellBounds();
        const headerDeselectionBounds = headerDeselection.getBounds();

        // 1. Fragment regular cell selections (NEW: Excel-like behavior)
        const newSelections: Selection[] = [];
        for (const selection of this.selections) {
            const fragments = selection.fragmentExcluding(cellDeselectionBounds);
            newSelections.push(...fragments);
        }

        // 2. Fragment HeaderSelection of same type (existing behavior)
        const sameTypeSelections = headerType === 'row' ? this.headerSelectionsRows : this.headerSelectionsCols;
        const newSameTypeSelections: HeaderSelection[] = [];

        for (const headerSelection of sameTypeSelections) {
            const fragments = headerSelection.fragmentExcluding(headerDeselectionBounds, this.gridDimensions);
            newSameTypeSelections.push(...fragments);
        }

        // 3. Fragment HeaderSelection of opposite type (NEW: Excel-like behavior)
        const oppositeTypeSelections = headerType === 'row' ? this.headerSelectionsCols : this.headerSelectionsRows;
        const newOppositeTypeSelections: HeaderSelection[] = [];

        for (const headerSelection of oppositeTypeSelections) {
            const cellSelection = headerSelection.getCellSelection();
            const cellFragments = cellSelection.fragmentExcluding(cellDeselectionBounds);

            if (cellFragments.length === 0) {
                // HeaderSelection completely covered → remove (don't add to new array)
                // No action needed, headerSelection will be garbage collected
            } else if (cellFragments.length === 1) {
                // Check if bounds are identical (not affected)
                const originalBounds = cellSelection.getBounds();
                const fragmentBounds = cellFragments[0].getBounds();
                const isUnaffected =
                    originalBounds.topLeft.row === fragmentBounds.topLeft.row &&
                    originalBounds.topLeft.col === fragmentBounds.topLeft.col &&
                    originalBounds.bottomRight.row === fragmentBounds.bottomRight.row &&
                    originalBounds.bottomRight.col === fragmentBounds.bottomRight.col;

                if (isUnaffected) {
                    // HeaderSelection NOT affected → keep as HeaderSelection
                    newOppositeTypeSelections.push(headerSelection);
                } else {
                    // HeaderSelection partially affected → convert fragment to regular Selection
                    newSelections.push(...cellFragments);
                }
            } else {
                // HeaderSelection partially affected → convert fragments to regular Selections
                newSelections.push(...cellFragments);
            }
        }

        // 4. Update all selection arrays
        this.selections = newSelections;
        if (headerType === 'row') {
            this.headerSelectionsRows = newSameTypeSelections;
            this.headerSelectionsCols = newOppositeTypeSelections;
        } else {
            this.headerSelectionsRows = newOppositeTypeSelections;
            this.headerSelectionsCols = newSameTypeSelections;
        }

        // 5. Maintain active state and synchronize visual representation
        const allSelections = [...this.selections, ...this.headerSelectionsRows, ...this.headerSelectionsCols];
        if (!allSelections.some(sel => sel.isActiveSelection()) && allSelections.length > 0) {
            const lastSelection = allSelections[allSelections.length - 1];
            if (lastSelection) {
                lastSelection.setActive(true);
            }
        }

        // Update visual state for both cells and headers
        this.syncSelectedCells();
        this.syncSelectedHeaders();
    }

    // ==================== HEADERS SELECTION METHODS ====================

    // Helper method to get header component from any of the header maps
    private getHeaderComponent(key: string): HeaderComponent<any> | null {
        // Try row headers
        let headerComponent: HeaderComponent<any> | undefined = this.rowHeaderComponents.get(key);
        if (headerComponent) return headerComponent;

        // Try column headers
        headerComponent = this.colHeaderComponents.get(key);
        if (headerComponent) return headerComponent;

        // Try corner header if the key matches
        if (this.cornerHeaderComponent) {
            const cornerKey = `${this.cornerHeaderComponent.position.headerType}-${this.cornerHeaderComponent.position.index}`;
            if (key === cornerKey) return this.cornerHeaderComponent;
        }

        return null;
    }

    // Create a new header selection and add it to the list
    private createHeaderSelection(headerType: 'row' | 'col', anchor: number, pointer: number): HeaderSelection {

        // Get the appropriate array for this header type
        const headerSelections = headerType === 'row' ? this.headerSelectionsRows : this.headerSelectionsCols;
        const totalExisting = this.headerSelectionsRows.length + this.headerSelectionsCols.length;

        // Deactivate all previous header selections of both types
        this.headerSelectionsRows.forEach(sel => sel.setActive(false));
        this.headerSelectionsCols.forEach(sel => sel.setActive(false));

        // Create new header selection as active
        const newHeaderSelection = new HeaderSelection(headerType, anchor, pointer, this.gridDimensions, true);
        headerSelections.push(newHeaderSelection);

        const newTotal = this.headerSelectionsRows.length + this.headerSelectionsCols.length;
        return newHeaderSelection;
    }

    // Multiple Header Selection - Adds new header selection, keeps previous ones
    private addNewHeaderSelection(headerType: 'row' | 'col', anchor: number, pointer: number): void {

        // Create new header selection without affecting existing ones
        this.createHeaderSelection(headerType, anchor, pointer);

        // Sync selected headers after adding new selection
        this.syncSelectedHeaders();
    }

    // Sync selected headers from HeaderSelection objects to visual representation
    private syncSelectedHeaders(): void {
        const allRowHeaders = new Set<number>();
        const allColHeaders = new Set<number>();

        // Collect all headers from current row header selections
        this.headerSelectionsRows.forEach(headerSelection => {
            headerSelection.getHeaderIndices().forEach(index => {
                allRowHeaders.add(index);
            });
        });

        // Collect all headers from current col header selections
        this.headerSelectionsCols.forEach(headerSelection => {
            headerSelection.getHeaderIndices().forEach(index => {
                allColHeaders.add(index);
            });
        });

        // Update visual representation of selected headers
        this.updateHeaderSelections(allRowHeaders, allColHeaders, true);
    }

    // Process new header selection based on header position and navigation state
    private processNewHeaderSelection(headerPos: HeaderPosition, navigationState: NavigationAnchorsAndPointers): void {

        if (headerPos.headerType === 'row') {
            // For row headers, use row anchors and pointers
            this.addNewHeaderSelection('row', navigationState.headerAnchorRow, navigationState.headerPointerRow);
        } else if (headerPos.headerType === 'col') {
            // For col headers, use col anchors and pointers
            this.addNewHeaderSelection('col', navigationState.headerAnchorCol, navigationState.headerPointerCol);
        } else {
            console.warn(`[SelectionHandler] processNewHeaderSelection: unsupported header type: ${headerPos.headerType}`);
        }

        // Corner headers are not supported for primary selection yet
        // They only participate in derived selections
    }

    private applyHeaderChanges(toDeselectRows: Set<number>, toDeselectCols: Set<number>, toSelectRows: Set<number>, toSelectCols: Set<number>) {
		// Deselect specific row headers
		toDeselectRows.forEach(index => {
			const key = `row-${index}`;
			const headerComponent = this.getHeaderComponent(key);
			if (headerComponent) {
				headerComponent.selected = false;
			}
		});

		// Deselect specific column headers
		toDeselectCols.forEach(index => {
			const key = `col-${index}`;
			const headerComponent = this.getHeaderComponent(key);
			if (headerComponent) {
				headerComponent.selected = false;
			}
		});

		// Select specific row headers
		toSelectRows.forEach(index => {
			const key = `row-${index}`;
			const headerComponent = this.getHeaderComponent(key);
			if (headerComponent) {
				headerComponent.selected = true;
			}
		});

		// Select specific column headers
		toSelectCols.forEach(index => {
			const key = `col-${index}`;
			const headerComponent = this.getHeaderComponent(key);
			if (headerComponent) {
				headerComponent.selected = true;
			}
		});
	}

	// ==================== SELECTION REFLECTION METHODS ====================

	/**
	 * Get currently selected headers (for debugging or other purposes)
	 */
	getSelectedHeaders(): Set<string> {
		const allHeaders = new Set<string>();

		// Add row headers with prefix
		this.selectedRowHeaders.forEach(index => {
			allHeaders.add(`row-${index}`);
		});

		// Add column headers with prefix
		this.selectedColHeaders.forEach(index => {
			allHeaders.add(`col-${index}`);
		});

		return allHeaders;
	}

	/**
	 * Get currently selected row header indices
	 */
	getSelectedRowHeaders(): Set<number> {
		return new Set(this.selectedRowHeaders);
	}

	/**
	 * Get currently selected column header indices
	 */
	getSelectedColHeaders(): Set<number> {
		return new Set(this.selectedColHeaders);
	}

	/**
	 * Check if a row header is selected
	 */
	isRowHeaderSelected(index: number): boolean {
		return this.selectedRowHeaders.has(index);
	}

	/**
	 * Check if a column header is selected
	 */
	isColHeaderSelected(index: number): boolean {
		return this.selectedColHeaders.has(index);
	}

}

export class Selection {
    // Rectangular selection defined by two corners
    private topLeft!: GridPosition;
    private bottomRight!: GridPosition;

    // Set of cells in this selection
    private cells: Set<string>;

    // Headers affected by this selection (derived)
    private affectedRowHeaders: Set<number>;
    private affectedColHeaders: Set<number>;

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
        this.affectedRowHeaders = new Set<number>();
        this.affectedColHeaders = new Set<number>();

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

    // Get headers affected by this selection (derived headers)
    getDerivedRowHeaders(): Set<number> {
        return new Set(this.affectedRowHeaders);
    }

    getDerivedColHeaders(): Set<number> {
        return new Set(this.affectedColHeaders);
    }

    getDerivedHeaders(): { rows: Set<number>, cols: Set<number> } {
        return {
            rows: this.getDerivedRowHeaders(),
            cols: this.getDerivedColHeaders()
        };
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
        this.affectedRowHeaders.clear();
        this.affectedColHeaders.clear();

        for (let row = this.topLeft.row; row <= this.bottomRight.row; row++) {
            this.affectedRowHeaders.add(row);
            for (let col = this.topLeft.col; col <= this.bottomRight.col; col++) {
                this.affectedColHeaders.add(col);
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

        // No intersection, return original selection as single fragment
        if (noIntersection)  {
            return [this];
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

export class HeaderSelection {
    // Direction of the header selection (row or column)
    private direction: 'row' | 'col';

    // Range defined by start and end indices
    private startIndex!: number;
    private endIndex!: number;

    // Set of header indices in this selection
    private headerIndices: Set<number>;

    // Grid area for header subgrid CSS grid layout
    private headerGridArea!: {
        rowStart: number;
        rowEnd: number;
        colStart: number;
        colEnd: number;
    };

    // Active state of the header selection (independent from cellSelection)
    private isActive: boolean;

    // Timestamp of creation
    private createdAt: number;

    // Internal Selection that represents the cells affected by this header selection
    // This Selection is ALWAYS inactive (isActive: false) as it's only for derived cell calculations
    private cellSelection: Selection;

    constructor(
        direction: 'row' | 'col',
        startIndex: number,
        endIndex: number,
        gridDimensions: GridDimensions,
        isActive: boolean = true
    ) {
        this.direction = direction;
        this.headerIndices = new Set<number>();
        this.isActive = isActive;
        this.createdAt = Date.now();

        // First, set bounds and calculate header-specific data
        this.updateBounds(startIndex, endIndex);

        // Then create internal cell selection based on calculated bounds
        // NOTE: cellSelection is ALWAYS inactive (false) - it's only for derived cell calculations
        this.cellSelection = this.createCellSelectionFromHeaders(gridDimensions, false);
    }

    // Update selection bounds and recalculate indices (header-specific only)
    updateBounds(startIndex: number, endIndex: number): void {
        this.startIndex = Math.min(startIndex, endIndex);
        this.endIndex = Math.max(startIndex, endIndex);
        this.recalculateHeaderIndices();
        this.updateHeaderGridArea();
    }

    // Update bounds and automatically sync the internal cellSelection
    updateBoundsWithSync(startIndex: number, endIndex: number, gridDimensions: GridDimensions): void {
        // Update header bounds first
        this.updateBounds(startIndex, endIndex);

        // Then sync the cellSelection with new bounds
        this.updateCellSelection(gridDimensions);
    }

    // Update the cell selection when bounds change
    updateCellSelection(gridDimensions: GridDimensions): void {
        const { topLeft, bottomRight } = this.calculateCellBounds(gridDimensions);
        this.cellSelection.updateBounds(topLeft, bottomRight);
        // Ensure cellSelection remains inactive after updates
        this.cellSelection.setActive(false);
    }

    contains(index: number): boolean {
        return this.headerIndices.has(index);
    }

    getHeaderIndices(): Set<number> {
        return new Set(this.headerIndices);
    }

    getHeaderArea(): { indexStart: number; indexEnd: number; type: 'row' | 'col' } {
        return {
            indexStart: this.startIndex,
            indexEnd: this.endIndex,
            type: this.direction
        };
    }

    getBounds(): { startIndex: number, endIndex: number } {
        return {
            startIndex: this.startIndex,
            endIndex: this.endIndex
        };
    }

    getDirection(): 'row' | 'col' {
        return this.direction;
    }

    // Delegate cell-related methods to internal Selection
    getCells(): Set<string> {
        return this.cellSelection.getCells();
    }

    getCellBounds(): { topLeft: GridPosition, bottomRight: GridPosition } {
        return this.cellSelection.getBounds();
    }

    // Get the internal cell selection (for derived cell visualization)
    getCellSelection(): Selection {
        return this.cellSelection;
    }

    getGridArea(): { rowStart: number, rowEnd: number, colStart: number, colEnd: number } {
        return this.cellSelection.getGridArea();
    }

    // Get grid area specifically for header subgrid positioning
    getHeaderGridArea(): { rowStart: number, rowEnd: number, colStart: number, colEnd: number } {
        return { ...this.headerGridArea };
    }

    setActive(active: boolean): void {
        this.isActive = active;
        // NOTE: cellSelection remains ALWAYS inactive - it's only for derived cell calculations
    }

    isActiveSelection(): boolean {
        return this.isActive;
    }

    getCreatedAt(): number {
        return this.createdAt;
    }

    // Create a Selection instance that represents all cells in the selected headers
    // This Selection is ALWAYS inactive as it's only used for derived cell calculations
    private createCellSelectionFromHeaders(gridDimensions: GridDimensions, isActive: boolean): Selection {
        const { topLeft, bottomRight } = this.calculateCellBounds(gridDimensions);
        // Force isActive to false - cellSelection is never active, only used for calculations
        return new Selection(topLeft, bottomRight, false);
    }

    // Calculate the cell bounds that correspond to this header selection
    private calculateCellBounds(gridDimensions: GridDimensions): { topLeft: GridPosition, bottomRight: GridPosition } {
        if (this.direction === 'row') {
            // Row selection: all columns in the selected rows
            return {
                topLeft: { row: this.startIndex, col: 0 },
                bottomRight: { row: this.endIndex, col: gridDimensions.maxCol }
            };
        } else {
            // Column selection: all rows in the selected columns
            return {
                topLeft: { row: 0, col: this.startIndex },
                bottomRight: { row: gridDimensions.maxRow , col: this.endIndex }
            };
        }
    }

    // Recalculate header indices based on current bounds
    private recalculateHeaderIndices(): void {
        this.headerIndices.clear();
        for (let i = this.startIndex; i <= this.endIndex; i++) {
            this.headerIndices.add(i);
        }
    }

    // Update header grid area for CSS grid positioning
    private updateHeaderGridArea(): void {
        if (this.direction === 'row') {
            // Row headers: span across the row indices, single column
            this.headerGridArea = {
                rowStart: this.startIndex + 1, // 1-based for CSS grid
                rowEnd: this.endIndex + 2, // +2 because end is exclusive
                colStart: 1, // Row headers are in column 1 of header subgrid
                colEnd: 2 // Single column span
            };
        } else {
            // Column headers: span across the column indices, single row
            this.headerGridArea = {
                rowStart: 1, // Column headers are in row 1 of header subgrid
                rowEnd: 2, // Single row span
                colStart: this.startIndex + 1, // 1-based for CSS grid
                colEnd: this.endIndex + 2 // +2 because end is exclusive
            };
        }
    }

    // Fragment this selection excluding a given range
    fragmentExcluding(excludeRange: { startIndex: number, endIndex: number }, gridDimensions: GridDimensions): HeaderSelection[] {
        const fragments: HeaderSelection[] = [];

        const excludeStart = excludeRange.startIndex;
        const excludeEnd = excludeRange.endIndex;

        // Calculate intersection
        const intersectStart = Math.max(this.startIndex, excludeStart);
        const intersectEnd = Math.min(this.endIndex, excludeEnd);

        // Check if there is no intersection
        const noIntersection = intersectStart > intersectEnd;

        if (noIntersection) {
            // No intersection, return original selection as single fragment
            return [this];
        }

        // Check if the selection is fully covered by the exclusion
        const fullCover =
            intersectStart === this.startIndex &&
            intersectEnd === this.endIndex;

        if (fullCover) {
            // Fully covered, return empty array
            return [];
        }

        // Left fragment (before exclusion)
        if (this.startIndex < intersectStart) {
            fragments.push(new HeaderSelection(
                this.direction,
                this.startIndex,
                intersectStart - 1,
                gridDimensions,
                false // Set as inactive initially
            ));
        }

        // Right fragment (after exclusion)
        if (intersectEnd < this.endIndex) {
            fragments.push(new HeaderSelection(
                this.direction,
                intersectEnd + 1,
                this.endIndex,
                gridDimensions,
                false // Set as inactive initially
            ));
        }

        // Set active state for the first fragment if this selection was active
        if (this.isActiveSelection() && fragments.length > 0) {
            fragments[0].setActive(true);
        }

        return fragments;
    }
}
