import type {
    GridPosition,
    HeaderPosition,
    CellComponent,
    HeaderComponent,
    MouseEventAnalysis,
    NavigationAnchorsAndPointers,
    GridDimensions,
    KeyboardNavigationAnalysis,
} from '../types/types.ts';
import { Selection } from './Selection.ts';
import { HeaderSelection } from './HeaderSelection.ts';
import { analyzeRectangularSelections, findConsecutiveHeaderRanges } from './SelectionAlgorithms.ts';
import { HeaderReflectionTracker } from './HeaderReflectionTracker.ts';
import { DeselectionManager, type DeselectionResult } from './DeselectionManager.ts';
import { SelectionSynchronizer } from './SelectionSynchronizer.ts';


// Callback type for selection changes
export type SelectionChangedCallback<TExtraProps, TRowHeaderProps, TColHeaderProps> =
    (handler: SelectionHandler<TExtraProps, TRowHeaderProps, TColHeaderProps>) => void;

// Callback type for header reflection changes (borders)
export type HeaderReflectionCallback = (
    toAddRowReflections: Set<number>,
    toRemoveRowReflections: Set<number>,
    toAddColReflections: Set<number>,
    toRemoveColReflections: Set<number>
) => void;


/**
 * Entry point to the selection domain. Owns the current selections states and orchestrates
 * updates to them based on input from the navigation and interaction handlers.
 */
export default class SelectionHandler<TExtraProps = undefined, TRowHeaderProps = undefined, TColHeaderProps = undefined> {
    private synchronizer: SelectionSynchronizer<TExtraProps, TRowHeaderProps, TColHeaderProps>;
    private selections: Selection[];
    private onSelectionsChanged?: SelectionChangedCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>;
    private onDeselectionsChanged?: SelectionChangedCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>;
    private onDeselectionFinished?: (resultingActiveSelection: 'cell' | 'header-row' | 'header-col' | null,
        anchor: GridPosition | number, pointer: GridPosition | number) => void;
    private onHeaderReflectionChanged?: HeaderReflectionCallback;
    private deselectionManager: DeselectionManager;
    private headerSelectionsRows: HeaderSelection[];
    private headerSelectionsCols: HeaderSelection[];
    private gridDimensions: GridDimensions;
    private activeSelection: Selection | HeaderSelection | null;
    private headerReflectionTracker: HeaderReflectionTracker;

    constructor(
        gridDimensions: GridDimensions,
        cellComponents: Map<string, CellComponent<TExtraProps>>,
        rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>,
        colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>,
        cornerHeaderComponent: HeaderComponent | null,
        onSelectionsChanged?: SelectionChangedCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        onDeselectionsChanged?: SelectionChangedCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        onDeselectionFinished?: (resultingActiveSelection: 'cell' | 'header-row' | 'header-col' | null,
            anchor: GridPosition | number, pointer: GridPosition | number) => void,
        onHeaderReflectionChanged?: HeaderReflectionCallback
    ) {
        this.gridDimensions = gridDimensions;
        this.synchronizer = new SelectionSynchronizer(cellComponents, rowHeaderComponents, colHeaderComponents, cornerHeaderComponent);
        this.selections = [];
        this.onSelectionsChanged = onSelectionsChanged;
        this.onDeselectionsChanged = onDeselectionsChanged;
        this.onDeselectionFinished = onDeselectionFinished;
        this.onHeaderReflectionChanged = onHeaderReflectionChanged;
        this.deselectionManager = new DeselectionManager();
        this.headerSelectionsRows = [];
        this.headerSelectionsCols = [];
        this.activeSelection = null;
        this.headerReflectionTracker = new HeaderReflectionTracker();
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

    clearSelections() {
        this.selections = [];
        this.headerSelectionsRows = [];
        this.headerSelectionsCols = [];
        this.syncSelectedCells();
        this.syncSelectedHeaders();
    }

    // ==================== HEADER REFLECTION METHODS ====================

    private fireHeaderReflectionIfChanged(): void {
        if (!this.onHeaderReflectionChanged) return;
        const diff = this.headerReflectionTracker.update(this.selections);
        if (diff) {
            this.onHeaderReflectionChanged(
                diff.addedRows,
                diff.removedRows,
                diff.addedCols,
                diff.removedCols
            );
        }
    }

    // Getters
    getSelectedCells(): Set<string> {
        return this.synchronizer.getSelectedCells();
    }

    getSelectedPositions(): GridPosition[] {
        return Array.from(this.synchronizer.getSelectedCells()).map(key => this.keyToPosition(key));
    }

    isCellSelected(position: GridPosition): boolean {
        return this.synchronizer.isCellSelected(this.positionToKey(position));
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
        const allCells = this.synchronizer.getSelectedCells();
        this.headerSelectionsRows.forEach(hs => hs.getCells().forEach(c => allCells.add(c)));
        this.headerSelectionsCols.forEach(hs => hs.getCells().forEach(c => allCells.add(c)));
        return allCells;
    }

    processKeyboardSelection(analysis: KeyboardNavigationAnalysis, navigationState: NavigationAnchorsAndPointers): void {
        const { selectionAction, navigationAction, activeSelectionType } = analysis;

        // Extract current position and anchor from navigation state
        const currentPosition = navigationState.cellPointer;
        const anchor = navigationState.cellAnchor;

        // Switch case based on selection action (keyboard only handles new-selection and update-selection)
        switch (selectionAction) {
            case 'new-selection':
                // Clear existing selections and create new single cell selection
                this.clearSelections();
                this.addNewSelection(anchor, currentPosition);
                break;

            case 'update-selection':
                // Update active selection (extend or update existing selection)
                const activeSelection = this.getActiveSelection();

                if (navigationAction === 'header-navigation') {
                    // Header navigation: update active header selection
                    if (activeSelectionType === 'header-row') {
                        if (activeSelection instanceof HeaderSelection && activeSelection.getDirection() === 'row') {
                            this.updateActiveHeaderSelection(activeSelection, navigationState.headerAnchorRow, navigationState.headerPointerRow);
                        } else {
                            console.warn('[SelectionHandler] update-selection: Active selection is not a row HeaderSelection.');
                        }
                    } else if (activeSelectionType === 'header-col') {
                        if (activeSelection instanceof HeaderSelection && activeSelection.getDirection() === 'col') {
                            this.updateActiveHeaderSelection(activeSelection, navigationState.headerAnchorCol, navigationState.headerPointerCol);
                        } else {
                            console.warn('[SelectionHandler] update-selection: Active selection is not a col HeaderSelection.');
                        }
                    }
                } else {
                    // Cell navigation: update active cell selection
                    if (activeSelection instanceof Selection) {
                        this.updateActiveSelection(activeSelection, anchor, currentPosition);
                    } else {
                        console.warn('[SelectionHandler] update-selection: Active selection is not a cell Selection.');
                    }
                }
                break;

            case 'none':
                // No selection action needed
                break;

            default:
                // Log unknown actions for debugging (should not happen with keyboard)
                console.warn('Unsupported keyboard selection action:', selectionAction);
                break;
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
                        this.deselectionManager.activate();
                        if (headerPos.headerType === 'row') {
                            this.deselectionManager.startHeaderDeselection('row', navigationState.headerAnchorRow, navigationState.headerPointerRow, this.gridDimensions);
                        } else if (headerPos.headerType === 'col') {
                            this.deselectionManager.startHeaderDeselection('col', navigationState.headerAnchorCol, navigationState.headerPointerCol, this.gridDimensions);
                        }
                        if (this.onDeselectionsChanged) this.onDeselectionsChanged(this);
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
                        this.deselectionManager.activate();
                        this.deselectionManager.startCellDeselection(anchor, currentPosition);
                        if (this.onDeselectionsChanged) this.onDeselectionsChanged(this);
                    } else {
                        // Create new selection, keep existing ones
                        this.addNewSelection(anchor, currentPosition);
                    }
                }
                break;

            case 'update-selection':
                // Update active selection (drag continues or shift+mousedown)
                if (this.deselectionManager.isActive) {
                    // Determine if we're deselecting headers or cells
                    if (this.deselectionManager.getHeaderDeselection() !== null) {
                        // Header deselection active - update header deselection area
                        const headerType = this.deselectionManager.getHeaderDeselection()!.getDirection();

                        if (headerType === 'row') {
                            this.deselectionManager.updateHeaderDeselection('row', navigationState.headerAnchorRow, navigationState.headerPointerRow, this.gridDimensions);
                        } else if (headerType === 'col') {
                            this.deselectionManager.updateHeaderDeselection('col', navigationState.headerAnchorCol, navigationState.headerPointerCol, this.gridDimensions);
                        }
                    } else {
                        // Cell deselection active - use existing logic
                        this.deselectionManager.updateCellDeselection(anchor, currentPosition);
                    }
                    if (this.onDeselectionsChanged) this.onDeselectionsChanged(this);
                } else {
                    const activeSelection = this.getActiveSelection();
                    // Normal selection active - use dragging context to determine initial context
                    if (draggingContext.dragType === 'row' || draggingContext.dragType === 'col') {
                        // Header selection context - verify active selection is HeaderSelection of correct type
                        const headerType = draggingContext.dragType as 'row' | 'col';

                        if (activeSelection instanceof HeaderSelection && activeSelection.getDirection() === headerType) {
                            // Update existing active header selection
                            if (headerType === 'row') {
                                this.updateActiveHeaderSelection(activeSelection, navigationState.headerAnchorRow, navigationState.headerPointerRow);
                            } else {
                                this.updateActiveHeaderSelection(activeSelection, navigationState.headerAnchorCol, navigationState.headerPointerCol);
                            }
                        } else {
                            // Active selection is not HeaderSelection of correct type
                            console.warn('[SelectionHandler] update-selection: Mismatch of activeSelection type.');
                        }
                    } else {
                        // Cell selection context - verify active selection is Selection
                        if (activeSelection instanceof Selection) {
                            this.updateActiveSelection(activeSelection, anchor, currentPosition);
                        } else {
                            // Active selection is not Selection
                            console.warn('[SelectionHandler] update-selection: Active selection is not a cell Selection.');
                        }
                    }
                }
                break;

            case 'finalize-selection':
                // Mouseup: Finalize current selection state
                if (this.deselectionManager.isActive) {
                    this.deselectionManager.deactivate();

                    if (this.deselectionManager.getHeaderDeselection() !== null) {
                        // Finalize header deselection
                        const result = this.deselectionManager.applyHeaderDeselection(
                            this.selections, this.headerSelectionsRows, this.headerSelectionsCols,
                            this.activeSelection, this.gridDimensions
                        );
                        this.applyDeselectionResult(result);
                        this.deselectionManager.clearHeaderDeselection();
                    } else if (this.deselectionManager.getDeselection() !== null) {
                        // Finalize cell deselection
                        const result = this.deselectionManager.applyCellDeselection(
                            this.selections, this.headerSelectionsRows, this.headerSelectionsCols,
                            this.activeSelection
                        );
                        this.applyDeselectionResult(result);
                        this.deselectionManager.clearCellDeselection();
                    }
                    if (this.onDeselectionsChanged) this.onDeselectionsChanged(this);
                    this.executeEndDeselectionCallback();
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

    // Update Active - Modifies the currently active selection
    private updateActiveSelection(activeSelection: Selection, position1: GridPosition, position2: GridPosition): void {
        // Update existing active selection
        activeSelection.updateBounds(position1, position2);
        // Sync selected cells after updating active selection
        this.syncSelectedCells();
    }

    // Get the currently active selection
    public getActiveSelection(): Selection | HeaderSelection | null {
        return this.activeSelection;
    }

    public getActiveSelectionType(): 'cell' | 'header-row' | 'header-col' | null {
        if (this.activeSelection instanceof Selection) {
            return 'cell';
        } else if (this.activeSelection instanceof HeaderSelection) {
            const headerType = this.activeSelection.getDirection();
            return headerType === 'row' ? 'header-row' : 'header-col';
        }
        return null;
    }

    private setActiveSelection(selection: Selection | HeaderSelection | null): void {
        this.activeSelection = selection;
    }

    private isHeaderSelected(headerType: 'row' | 'col', index: number): boolean {
        return headerType === 'row'
            ? this.synchronizer.isRowHeaderSelected(index)
            : this.synchronizer.isColHeaderSelected(index);
    }

    // Update Active Header Selection - Modifies the currently active header selection
    private updateActiveHeaderSelection(activeHeaderSelection: HeaderSelection, anchor: number, pointer: number): void {
        // Update existing active header selection
        activeHeaderSelection.updateBoundsWithSync(anchor, pointer, this.gridDimensions);
        // Sync selected headers after updating active selection
        this.syncSelectedHeaders();
    }

    // Create a new selection and add it to the list
    private createSelection(position1: GridPosition, position2: GridPosition): Selection {
        // Create new selection as active
        const newSelection = new Selection(position1, position2);
        this.selections.push(newSelection);
        this.setActiveSelection(newSelection);

        return newSelection;
    }

    private syncSelectedCells(): void {
        const allCells = new Set<string>();
        this.selections.forEach(selection => {
            selection.getCells().forEach(cell => allCells.add(cell));
        });
        if (!this.synchronizer.syncCells(allCells)) return;
        this.fireHeaderReflectionIfChanged();
        if (this.onSelectionsChanged) this.onSelectionsChanged(this);
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

    getDeselection(): Selection | null {
        return this.deselectionManager.getDeselection();
    }

    getHeaderDeselection(): HeaderSelection | null {
        return this.deselectionManager.getHeaderDeselection();
    }

    // ===================== END DESELECTION CALLBACK EXECUTION =====================

    private applyDeselectionResult(result: DeselectionResult): void {
        this.selections = result.selections;
        this.headerSelectionsRows = result.headerSelectionsRows;
        this.headerSelectionsCols = result.headerSelectionsCols;
        this.activeSelection = result.activeSelection;
        this.syncSelectedCells();
        this.syncSelectedHeaders();
    }

    private executeEndDeselectionCallback(): void {
        if (!this.onDeselectionFinished) return;
        const resultingActiveSelection = this.getActiveSelection();
        if (resultingActiveSelection instanceof HeaderSelection) {
            const headerType = resultingActiveSelection.getDirection();
            const bounds = resultingActiveSelection.getBounds();
            this.onDeselectionFinished(headerType === 'row' ? 'header-row' : 'header-col',
                bounds.startIndex, bounds.endIndex);
        } else if (resultingActiveSelection instanceof Selection) {
            const bounds = resultingActiveSelection.getBounds();
            this.onDeselectionFinished('cell', { row: bounds.topLeft.row, col: bounds.topLeft.col },
                { row: bounds.bottomRight.row, col: bounds.bottomRight.col });
        } // If no active selection remains, no callback is executed
    }

    // ==================== HEADERS SELECTION METHODS ====================

    // Create a new header selection and add it to the list
    private createHeaderSelection(headerType: 'row' | 'col', anchor: number, pointer: number): HeaderSelection {
        // Get the appropriate array for this header type
        const headerSelections = headerType === 'row' ? this.headerSelectionsRows : this.headerSelectionsCols;

        // Create new header selection as active
        const newHeaderSelection = new HeaderSelection(headerType, anchor, pointer, this.gridDimensions);
        headerSelections.push(newHeaderSelection);
        this.setActiveSelection(newHeaderSelection);

        return newHeaderSelection;
    }

    // Multiple Header Selection - Adds new header selection, keeps previous ones
    private addNewHeaderSelection(headerType: 'row' | 'col', anchor: number, pointer: number): void {

        // Create new header selection without affecting existing ones
        this.createHeaderSelection(headerType, anchor, pointer);

        // Sync selected headers after adding new selection
        this.syncSelectedHeaders();
    }

    private syncSelectedHeaders(): void {
        const allRowHeaders = new Set<number>();
        const allColHeaders = new Set<number>();
        this.headerSelectionsRows.forEach(hs => hs.getHeaderIndices().forEach(i => allRowHeaders.add(i)));
        this.headerSelectionsCols.forEach(hs => hs.getHeaderIndices().forEach(i => allColHeaders.add(i)));
        if (!this.synchronizer.syncHeaders(allRowHeaders, allColHeaders)) return;
        if (this.onSelectionsChanged) this.onSelectionsChanged(this);
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

    getSelectedHeaders(): Set<string> {
        const allHeaders = new Set<string>();
        this.synchronizer.getSelectedRowHeaders().forEach(i => allHeaders.add(`row-${i}`));
        this.synchronizer.getSelectedColHeaders().forEach(i => allHeaders.add(`col-${i}`));
        return allHeaders;
    }

    getSelectedRowHeaders(): number[] {
        return this.synchronizer.getSelectedRowHeaders();
    }

    getSelectedColHeaders(): number[] {
        return this.synchronizer.getSelectedColHeaders();
    }

    isRowHeaderSelected(index: number): boolean {
        return this.synchronizer.isRowHeaderSelected(index);
    }

    isColHeaderSelected(index: number): boolean {
        return this.synchronizer.isColHeaderSelected(index);
    }

    // ==================== HARD ALGORITHMS =====================

    // Analyze positions to find optimal rectangular groupings
    // ==================== HEADER SUBSET CALCULATIONS =====================

    /**
     * Calculate intersection of cells between row header selections and column header selections
     * @param rowSelections Array of row header selections
     * @param colSelections Array of column header selections
     * @returns Set of cell keys that exist in both row and column selections
     */
    calculateRowColIntersection(
        rowSelections: HeaderSelection[],
        colSelections: HeaderSelection[]
    ): Set<string> {
        // Get all cells from row header selections
        const rowCells = new Set<string>();
        rowSelections.forEach(headerSelection => {
            headerSelection.getCells().forEach(cell => rowCells.add(cell));
        });

        // Get all cells from column header selections
        const colCells = new Set<string>();
        colSelections.forEach(headerSelection => {
            headerSelection.getCells().forEach(cell => colCells.add(cell));
        });

        // Calculate intersection: cells that exist in both sets
        const intersection = new Set<string>();
        rowCells.forEach(cell => {
            if (colCells.has(cell)) {
                intersection.add(cell);
            }
        });

        return intersection;
    }

    // ==================== SELECTION APIs FOR EXTERNAL USE =====================

    // Add multiple individual selections
    addMultipleSelections(positions: GridPosition[]): void {
        positions.forEach(pos => {
            this.addNewSelection(pos, pos);
        });
    }

    // Add intelligent selections - automatically groups positions into rectangular selections
    addIntelligentSelections(positions: GridPosition[]): void {
        if (positions.length === 0) return;

        const analysis = analyzeRectangularSelections(positions, this.gridDimensions);

        // Create rectangular selections
        analysis.rectangles.forEach(rect => {
            this.addNewSelection(rect.topLeft, rect.bottomRight);
        });

        // Create individual selections for isolated positions
        analysis.individuals.forEach(pos => {
            this.addNewSelection(pos, pos);
        });
    }

    // Add multiple cell range selections
    addMultipleCellRanges(cellRanges: Array<{ topLeft: GridPosition, bottomRight: GridPosition }>): void {
        cellRanges.forEach(range => {
            this.addNewSelection(range.topLeft, range.bottomRight);
        });
    }

    // Add multiple header range selections
    addMultipleHeaderRanges(headerType: 'row' | 'col', headerRanges: Array<{ startIndex: number, endIndex: number }>): void {
        headerRanges.forEach(range => {
            this.addNewHeaderSelection(headerType, range.startIndex, range.endIndex);
        });
    }

    // Add multiple individual header selections
    addMultipleHeaderSelections(headerType: 'row' | 'col', indices: number[]): void {
        indices.forEach(index => {
            this.addNewHeaderSelection(headerType, index, index);
        });
    }

    // Add intelligent header selections - automatically groups consecutive headers into ranges (operates by type)
    addIntelligentHeaderSelections(headerType: 'row' | 'col', indices: number[]): void {
        if (indices.length === 0) return;

        const analysis = findConsecutiveHeaderRanges(indices);

        // Create ranges
        analysis.ranges.forEach(range => {
            this.addNewHeaderSelection(headerType, range.start, range.end);
        });

        // Create individual selections
        analysis.individuals.forEach(index => {
            this.addNewHeaderSelection(headerType, index, index);
        });
    }

}
