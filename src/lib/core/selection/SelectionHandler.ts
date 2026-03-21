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
import { analyzeRectangularSelections, findConsecutiveHeaderRanges, calculateRowColIntersection } from './SelectionAlgorithms.ts';
import { DeselectionManager, type DeselectionResult } from './DeselectionManager.ts';
import { SelectionStore } from './SelectionStore.ts';


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
    private store: SelectionStore<TExtraProps, TRowHeaderProps, TColHeaderProps>;
    private onSelectionsChanged?: SelectionChangedCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>;
    private onDeselectionsChanged?: SelectionChangedCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>;
    private onDeselectionFinished?: (resultingActiveSelection: 'cell' | 'header-row' | 'header-col' | null,
        anchor: GridPosition | number, pointer: GridPosition | number) => void;
    private onHeaderReflectionChanged?: HeaderReflectionCallback;
    private deselectionManager: DeselectionManager;
    private gridDimensions: GridDimensions;

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
        this.store = new SelectionStore(cellComponents, rowHeaderComponents, colHeaderComponents, cornerHeaderComponent);
        this.onSelectionsChanged = onSelectionsChanged;
        this.onDeselectionsChanged = onDeselectionsChanged;
        this.onDeselectionFinished = onDeselectionFinished;
        this.onHeaderReflectionChanged = onHeaderReflectionChanged;
        this.deselectionManager = new DeselectionManager();
    }

    clearSelections() {
        this.store.clear();
        this.syncSelectedCells();
        this.syncSelectedHeaders();
    }

    // ==================== HEADER REFLECTION METHODS ====================

    private fireHeaderReflectionIfChanged(): void {
        if (!this.onHeaderReflectionChanged) return;
        const diff = this.store.getHeaderReflectionDiff();
        if (diff) {
            this.onHeaderReflectionChanged(diff.addedRows, diff.removedRows, diff.addedCols, diff.removedCols);
        }
    }

    // Getters
    getSelectedCells(): Set<string> {
        return this.store.getSelectedCells();
    }

    getSelectedPositions(): GridPosition[] {
        return this.store.getSelectedPositions();
    }

    isCellSelected(position: GridPosition): boolean {
        return this.store.isCellSelected(position);
    }

    // Excel-like behavior: Check if a cell is selected either directly or through header selections (on-demand)
    isAnyCellSelected(position: GridPosition): boolean {
        return this.store.isAnyCellSelected(position);
    }

    // Get all selected cells combining direct selections and header-derived selections (on-demand)
    getAllSelectedCells(): Set<string> {
        return this.store.getAllSelectedCells();
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
                            this.updateActiveHeaderSelection(navigationState.headerAnchorRow, navigationState.headerPointerRow);
                        } else {
                            console.warn('[SelectionHandler] update-selection: Active selection is not a row HeaderSelection.');
                        }
                    } else if (activeSelectionType === 'header-col') {
                        if (activeSelection instanceof HeaderSelection && activeSelection.getDirection() === 'col') {
                            this.updateActiveHeaderSelection(navigationState.headerAnchorCol, navigationState.headerPointerCol);
                        } else {
                            console.warn('[SelectionHandler] update-selection: Active selection is not a col HeaderSelection.');
                        }
                    }
                } else {
                    // Cell navigation: update active cell selection
                    if (activeSelection instanceof Selection) {
                        this.updateActiveSelection(anchor, currentPosition);
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
                                this.updateActiveHeaderSelection(navigationState.headerAnchorRow, navigationState.headerPointerRow);
                            } else {
                                this.updateActiveHeaderSelection(navigationState.headerAnchorCol, navigationState.headerPointerCol);
                            }
                        } else {
                            // Active selection is not HeaderSelection of correct type
                            console.warn('[SelectionHandler] update-selection: Mismatch of activeSelection type.');
                        }
                    } else {
                        // Cell selection context - verify active selection is Selection
                        if (activeSelection instanceof Selection) {
                            this.updateActiveSelection(anchor, currentPosition);
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
                            this.getSelections(), this.getHeaderSelectionsRows(), this.getHeaderSelectionsCols(),
                            this.getActiveSelection(), this.gridDimensions
                        );
                        this.applyDeselectionResult(result);
                        this.deselectionManager.clearHeaderDeselection();
                    } else if (this.deselectionManager.getDeselection() !== null) {
                        // Finalize cell deselection
                        const result = this.deselectionManager.applyCellDeselection(
                            this.getSelections(), this.getHeaderSelectionsRows(), this.getHeaderSelectionsCols(),
                            this.getActiveSelection()
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
        this.store.createAndAddSelection(position1, position2);
        this.syncSelectedCells();
    }

    selectSingle(position: GridPosition): void {
        this.clearSelections();
        this.addNewSelection(position, position);
    }

    // Update Active - Modifies the currently active selection
    private updateActiveSelection(position1: GridPosition, position2: GridPosition): void {
        this.store.updateActiveCellSelectionBounds(position1, position2);
        this.syncSelectedCells();
    }

    // Get the currently active selection
    public getActiveSelection(): Selection | HeaderSelection | null {
        return this.store.getActiveSelection();
    }

    public getActiveSelectionType(): 'cell' | 'header-row' | 'header-col' | null {
        return this.store.getActiveSelectionType();
    }

    private isHeaderSelected(headerType: 'row' | 'col', index: number): boolean {
        return headerType === 'row'
            ? this.store.isRowHeaderSelected(index)
            : this.store.isColHeaderSelected(index);
    }

    // Update Active Header Selection - Modifies the currently active header selection
    private updateActiveHeaderSelection(anchor: number, pointer: number): void {
        this.store.updateActiveHeaderSelectionBounds(anchor, pointer, this.gridDimensions);
        this.syncSelectedHeaders();
    }

    private syncSelectedCells(): void {
        if (!this.store.syncCells()) return;
        this.fireHeaderReflectionIfChanged();
        if (this.onSelectionsChanged) this.onSelectionsChanged(this);
    }

    getSelections(): Selection[] {
        return this.store.getSelections();
    }

    // Get current row header selections
    getHeaderSelectionsRows(): HeaderSelection[] {
        return this.store.getHeaderSelectionsRows();
    }

    // Get current column header selections
    getHeaderSelectionsCols(): HeaderSelection[] {
        return this.store.getHeaderSelectionsCols();
    }

    // Get all header selections (both rows and columns)
    getAllHeaderSelections(): HeaderSelection[] {
        return this.store.getAllHeaderSelections();
    }

    // Get derived cell selections from header selections (for visualization)
    getDerivedCellSelections(): Selection[] {
        return this.store.getDerivedCellSelections();
    }

    getDeselection(): Selection | null {
        return this.deselectionManager.getDeselection();
    }

    getHeaderDeselection(): HeaderSelection | null {
        return this.deselectionManager.getHeaderDeselection();
    }

    // ===================== END DESELECTION CALLBACK EXECUTION =====================

    private applyDeselectionResult(result: DeselectionResult): void {
        this.store.applyDeselectionResult(result);
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

    // Multiple Header Selection - Adds new header selection, keeps previous ones
    private addNewHeaderSelection(headerType: 'row' | 'col', anchor: number, pointer: number): void {
        this.store.createAndAddHeaderSelection(headerType, anchor, pointer, this.gridDimensions);
        this.syncSelectedHeaders();
    }

    private syncSelectedHeaders(): void {
        if (!this.store.syncHeaders()) return;
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
        return this.store.getSelectedHeaders();
    }

    getSelectedRowHeaders(): number[] {
        return this.store.getSelectedRowHeaders();
    }

    getSelectedColHeaders(): number[] {
        return this.store.getSelectedColHeaders();
    }

    isRowHeaderSelected(index: number): boolean {
        return this.store.isRowHeaderSelected(index);
    }

    isColHeaderSelected(index: number): boolean {
        return this.store.isColHeaderSelected(index);
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
        return calculateRowColIntersection(rowSelections, colSelections);
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
