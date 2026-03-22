import type {
    GridPosition,
    HeaderPosition,
    GridDimensions,
    NavigationState,
    NavigationAnchorsAndPointers,
    CellComponent,
    HeaderComponent,
    DraggingActionContext,
    MouseEventAnalysis,
    RenderArea,
    KeyboardNavigationAnalysis,
} from '../types/types.ts';
import type { ExternalEventPort } from '../ports/ExternalEventPort.ts';
import type { ViewportPort } from '../ports/ViewportPort.ts';
import { singleCellStep, singleHeaderStep, boundaryHeaderJump, isCellEmpty, findDataBoundary } from './NavigationAlgorithms.ts';
import { NavigationStore } from './NavigationStore.ts';
import { AutoScrollManager } from './AutoScrollManager.ts';
import { ViewportScrollCalculator } from './ViewportScrollCalculator.ts';

export type PointerPositionCallback = (handler: NavigationHandler<any, any, any>) => void;
export type DocumentMouseMoveCallback = (event: MouseEvent) => void;
export type AutoScrollSelectionCallback = (position: GridPosition, draggingContext: DraggingActionContext) => void;

export default class NavigationHandler<TExtraProps = undefined, TRowHeaderProps = undefined, TColHeaderProps = undefined> {
    private gridDimensions: GridDimensions;
    private store: NavigationStore;
    private viewportPort?: ViewportPort;
    private cellComponents: Map<string, CellComponent<TExtraProps>>;
    private pointerPositionCallback?: PointerPositionCallback;
    // Separate header components by type
    private rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>;
    private colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>;
    private cornerHeaderComponent: HeaderComponent | null;

    private autoScrollManager: AutoScrollManager;
    private viewportScrollCalculator: ViewportScrollCalculator;

    constructor(
        gridDimensions: GridDimensions,
        cellComponents: Map<string, CellComponent<TExtraProps>>,
        rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>,
        colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>,
        cornerHeaderComponent: HeaderComponent | null,
        pointerPositionCallback?: PointerPositionCallback,
        documentMouseMoveCallback?: DocumentMouseMoveCallback,
        autoScrollSelectionCallback?: AutoScrollSelectionCallback
    ) {
        this.gridDimensions = gridDimensions;
        this.cellComponents = cellComponents;
        this.rowHeaderComponents = rowHeaderComponents;
        this.colHeaderComponents = colHeaderComponents;
        this.cornerHeaderComponent = cornerHeaderComponent;
        this.store = new NavigationStore();
        this.pointerPositionCallback = pointerPositionCallback;
        this.viewportScrollCalculator = new ViewportScrollCalculator();
        this.autoScrollManager = new AutoScrollManager(
            this.store,
            () => this.gridDimensions,
            (pos) => this.movePointer(pos),
            (row) => this.store.setHeaderPointerRow(row),
            (col) => this.store.setHeaderPointerCol(col),
            documentMouseMoveCallback,
            autoScrollSelectionCallback
        );
    }

    // set grid spacing data
    setRowHeights(heights: number[]) {
        this.viewportScrollCalculator.setRowHeights(heights);
    }

    setColWidths(widths: number[]) {
        this.viewportScrollCalculator.setColWidths(widths);
    }

    setExternalEventPort(port: ExternalEventPort): void {
        this.autoScrollManager.setExternalEventPort(port);
    }

    setViewportPort(port: ViewportPort): void {
        this.viewportPort = port;
        this.viewportScrollCalculator.setViewportPort(port);
    }

    updateGridDimensions(dimensions: GridDimensions): void {
        this.gridDimensions = dimensions;
    }

    // Move pointer to specific position
    movePointer(position: GridPosition, behavior: 'smooth' | 'instant' = 'instant',
        mode: 'minimal' | 'initial' | 'final' = 'minimal'): GridPosition {
        const { maxRow, maxCol } = this.gridDimensions;

        if (position.row >= 0 && position.row <= maxRow &&
            position.col >= 0 && position.col <= maxCol) {
            this.store.setPointerPosition(position);
            this.viewportScrollCalculator.scrollToPosition(position, behavior, mode);
        }

        if (this.pointerPositionCallback) {
            this.pointerPositionCallback(this);
        }

        return this.getCurrentPosition();
    }

    /**
     * Process keyboard navigation events.
     * @param analysis Keyboard navigation analysis
     * @param visibleArea Render area for the current view
     */
    processKeyboardNavigation(analysis: KeyboardNavigationAnalysis, visibleArea?: RenderArea): void {
        if (!this.isNavigationMode() || analysis.navigationAction === 'none') return;

        const { direction, navigationAction, navigationType, activeSelectionType, extendingSelection } = analysis;

        // New approach: Handle different navigation actions, direction, extendingSelection, and navigationType
        switch (navigationAction) {
            case 'cell-navigation':
                const cellPointer = this.getCurrentPosition();
                const cellAnchor = this.getAnchor();
                let newCellPos: GridPosition;
                // single step navigation
                if (navigationType === 'single' && direction) {
                    newCellPos = singleCellStep(cellPointer, direction as 'up' | 'down' | 'left' | 'right', this.gridDimensions);
                    this.movePointer(newCellPos);
                } else if (navigationType === 'boundary' && direction) {
                    newCellPos = findDataBoundary(this.cellComponents, this.gridDimensions, cellPointer.row, cellPointer.col, direction as 'up' | 'down' | 'left' | 'right');
                    this.movePointer(newCellPos);
                    } else if (navigationType === 'page' && direction) {
                    newCellPos = { ...cellPointer };
                    switch (direction) {
                        case 'page-up':    newCellPos.row = this.viewportScrollCalculator.calculateVerticalPage(cellPointer.row, 'up', this.gridDimensions); break;
                        case 'page-down':  newCellPos.row = this.viewportScrollCalculator.calculateVerticalPage(cellPointer.row, 'down', this.gridDimensions); break;
                        case 'page-left':  newCellPos.col = this.viewportScrollCalculator.calculateHorizontalPage(cellPointer.col, 'left', this.gridDimensions); break;
                        case 'page-right': newCellPos.col = this.viewportScrollCalculator.calculateHorizontalPage(cellPointer.col, 'right', this.gridDimensions); break;
                    }
                    this.movePointer(newCellPos, 'instant', direction === 'page-up' || direction === 'page-left' ? 'initial' : 'final');
                } else {
                    // Fallback: no navigation
                    newCellPos = cellPointer;
                }
                // Coordinate anchor if not extending selection
                if (!extendingSelection) {
                    this.setAnchor(newCellPos);
                }
                break;
            case 'header-navigation':
                // Header navigation only updates pointer (not anchor) to update existing header selection
                if (activeSelectionType === 'header-row' || activeSelectionType === 'header-col') {
                    const headerType = activeSelectionType === 'header-row' ? 'row' : 'col';
                    const currentHeaderIndex = headerType === 'row' ? this.store.getHeaderPointerRow() : this.store.getHeaderPointerCol();
                    let newHeaderIndex: number;
                    let cellForHeader: GridPosition;

                    if (navigationType === 'single' && direction) {
                        newHeaderIndex = singleHeaderStep(currentHeaderIndex, direction as 'up' | 'down' | 'left' | 'right', headerType, this.gridDimensions);
                    } else if (navigationType === 'boundary' && direction) {
                        newHeaderIndex = boundaryHeaderJump(currentHeaderIndex, direction as 'up' | 'down' | 'left' | 'right', headerType, this.gridDimensions);
                    } else if (navigationType === 'page' && direction) {
                        const pageDir = direction as 'page-up' | 'page-down' | 'page-left' | 'page-right';
                        if (headerType === 'row') {
                            newHeaderIndex = (pageDir === 'page-up' || pageDir === 'page-left')
                                ? this.viewportScrollCalculator.calculateVerticalPage(currentHeaderIndex, 'up', this.gridDimensions)
                                : this.viewportScrollCalculator.calculateVerticalPage(currentHeaderIndex, 'down', this.gridDimensions);
                        } else {
                            newHeaderIndex = (pageDir === 'page-left' || pageDir === 'page-up')
                                ? this.viewportScrollCalculator.calculateHorizontalPage(currentHeaderIndex, 'left', this.gridDimensions)
                                : this.viewportScrollCalculator.calculateHorizontalPage(currentHeaderIndex, 'right', this.gridDimensions);
                        }
                    } else {
                        // Fallback: no navigation
                        newHeaderIndex = currentHeaderIndex;
                    }

                    // Update header pointer
                    if (headerType === 'row') {
                        this.store.setHeaderPointerRow(newHeaderIndex);
                        // Update cell pointer to reflect header selection (similar to processMouseNavigation)
                        cellForHeader = visibleArea ? { row: newHeaderIndex, col: visibleArea.startCol } : { row: newHeaderIndex, col: 0 };                        this.movePointer(cellForHeader);
                    } else {
                        this.store.setHeaderPointerCol(newHeaderIndex);
                        // Update cell pointer to reflect header selection (similar to processMouseNavigation)
                        cellForHeader = visibleArea ? { row: visibleArea.startRow, col: newHeaderIndex } : { row: 0, col: newHeaderIndex };
                    }
                    if (navigationType === 'page' && direction) {
                        this.movePointer(cellForHeader, 'instant', direction === 'page-up' || direction === 'page-left' ? 'initial' : 'final');
                    } else if (navigationType !== 'page' && direction) {
                        this.movePointer(cellForHeader);
                    }

                    // Note: No anchor coordination for header navigation as per specification
                    // Header navigation only moves pointer to update existing selection
                }
                break;
        }

    }

    /**
     * Process mouse navigation events.
     * @param analysis Mouse event analysis
     * @param visibleArea Render area for the current view
     */
    processMouseNavigation(analysis: MouseEventAnalysis, visibleArea?: RenderArea): void {
        const { type, position, navigationAction, componentType } = analysis;
        const context = this.getDraggingActionContext();

        // Switch case based on navigation action
        switch (navigationAction) {
            // Removed isDragging check for stuck drag state, since it is handled in InputAnalyzer
            case 'start-cell-drag':
                const cellPosition = position as GridPosition;
                this.setAnchor(cellPosition);
                this.movePointer(cellPosition);
                this.store.setDragging(true);

                // Setup outside dragging listeners
                this.autoScrollManager.setupListeners();
                break;

            case 'start-row-drag':
                const headerRowPos = position as HeaderPosition;
                // Set header navigation states
                this.store.setHeaderAnchorRow(headerRowPos.index);
                this.store.setHeaderPointerRow(headerRowPos.index);
                this.store.setDragging(true);

                // determine the first visible cell of the row and move pointer there
                const firstVisibleRowCell = visibleArea ? { row: headerRowPos.index, col: visibleArea.startCol } : undefined;
                if (firstVisibleRowCell) {
                    this.movePointer(firstVisibleRowCell);
                }

                // Setup outside dragging listeners
                this.autoScrollManager.setupListeners();
                break;

            case 'start-col-drag':
                // Column drag: Set header navigation states
                const headerColPos = position as HeaderPosition;
                // Set header navigation states
                this.store.setHeaderAnchorCol(headerColPos.index);
                this.store.setHeaderPointerCol(headerColPos.index);
                this.store.setDragging(true);

                // determine the first visible cell of the column and move pointer there
                const firstVisibleColCell = visibleArea ? { row: visibleArea.startRow, col: headerColPos.index } : undefined;
                if (firstVisibleColCell) {
                    this.movePointer(firstVisibleColCell);
                }

                // Setup outside dragging listeners
                this.autoScrollManager.setupListeners();
                break;

            case 'update-drag':
                // Shift+mousedown: Update pointer to extend active selection
                // Anchor remains from previous selection
                if (componentType === 'cell') {
                    // Cell update-drag
                    const cellPosition = position as GridPosition;
                    this.movePointer(cellPosition);
                    this.store.setDragging(true);
                } else {
                    // Header update-drag
                    if ((position as HeaderPosition).headerType === 'row') {
                        const headerRowPos = position as HeaderPosition;
                        this.store.setHeaderPointerRow(headerRowPos.index);
                        this.store.setDragging(true);
                    } else {
                        const headerColPos = position as HeaderPosition;
                        this.store.setHeaderPointerCol(headerColPos.index);
                        this.store.setDragging(true);
                    }
                }

                // Setup outside dragging listeners
                this.autoScrollManager.setupListeners();
                break;

            case 'continue-drag':
                // Check if we are in outside dragging mode
                if (this.autoScrollManager.isOutsideDragging()) {
                    if (analysis.outsideScrollAnalysis) {
                        this.autoScrollManager.processOutsideScrollAnalysis(analysis.outsideScrollAnalysis);
                    }
                    return;
                }

                // Normal continue-drag processing
                if (componentType === 'cell') {
                    if (context.dragType === 'cell') {
                        // Cell drag over cell: mover pointer de celda
                        this.movePointer(position as GridPosition);
                    } else if (context.dragType === 'row') {
                        // Row drag over cell: actualizar pointer de row
                        const cellPos = position as GridPosition;
                        this.store.setHeaderPointerRow(cellPos.row);
                        // determine the first visible cell of the row and move pointer there
                        const firstVisibleRowCell = visibleArea ? { row: cellPos.row, col: visibleArea.startCol } : undefined;
                        if (firstVisibleRowCell) {
                            this.movePointer(firstVisibleRowCell);
                        }
                    } else if (context.dragType === 'col') {
                        // Col drag over cell: actualizar pointer de col
                        const cellPos = position as GridPosition;
                        this.store.setHeaderPointerCol(cellPos.col);
                        // determine the first visible cell of the column and move pointer there
                        const firstVisibleColCell = visibleArea ? { row: visibleArea.startRow, col: cellPos.col } : undefined;
                        if (firstVisibleColCell) {
                            this.movePointer(firstVisibleColCell);
                        }
                    } else {
                        console.warn('Unknown drag type in continue-drag');
                        return;
                    }
                } else {
                    // componentType === 'header'
                    if (context.dragType === 'cell') {
                        // Cell drag over header - IGNORADO (comentado)
                        if ((position as HeaderPosition).headerType === 'col') {
                            /*
                            const colHeaderPos = position as HeaderPosition;
                            const colStart = this.getColumnSelectionRange(colHeaderPos.index);
                            this.movePointer(colStart.start);
                            */
                        } else {
                            /*
                            const rowHeaderPos = position as HeaderPosition;
                            const rowStart = this.getRowSelectionRange(rowHeaderPos.index);
                            this.movePointer(rowStart.start);
                            */
                        }
                    } else if (context.dragType === 'row') {
                        // Row drag over header: actualizar pointer de row
                        const rowHeaderPos = position as HeaderPosition;
                        this.store.setHeaderPointerRow(rowHeaderPos.index);
                        // determine the first visible cell of the row and move pointer there
                        const firstVisibleRowCell = visibleArea ? { row: rowHeaderPos.index, col: visibleArea.startCol } : undefined;
                        if (firstVisibleRowCell) {
                            this.movePointer(firstVisibleRowCell);
                        }
                    } else if (context.dragType === 'col') {
                        // Col drag over header: actualizar pointer de col
                        const colHeaderPos = position as HeaderPosition;
                        this.store.setHeaderPointerCol(colHeaderPos.index);
                        // determine the first visible cell of the column and move pointer there
                        const firstVisibleColCell = visibleArea ? { row: visibleArea.startRow, col: colHeaderPos.index } : undefined;
                        if (firstVisibleColCell) {
                            this.movePointer(firstVisibleColCell);
                        }
                    } else {
                        console.warn('Unknown drag type in continue-drag');
                        return;
                    }
                }
                break;

            case 'end-drag':
                if (this.isDragging()) {
                    this.store.setDragging(false);
                    this.autoScrollManager.cleanup();
                }
                break;

            case 'none':
                // No navigation action needed
                break;

            default:
                break;
        }
        // Update mouse action context based on analysis
        this.updateMouseActionContextFromAnalysis(analysis);
    }

    // Update mouse action context based on processed analysis
    updateMouseActionContextFromAnalysis(analysis: MouseEventAnalysis): void {
        const { type, position, navigationAction, componentType } = analysis;

        // Determine drag state based on navigation action
        const ctx = this.store.getDraggingActionContext();
        let isDragging = this.store.isDragging();
        let dragType = ctx.dragType;
        let dragOrigin = ctx.dragOrigin;

        // Start drag actions
        if (navigationAction === 'start-cell-drag') {
            isDragging = true;
            dragType = 'cell';
            dragOrigin = position;
        } else if (navigationAction === 'start-row-drag') {
            isDragging = true;
            dragType = 'row';
            dragOrigin = position;
        } else if (navigationAction === 'start-col-drag') {
            isDragging = true;
            dragType = 'col';
            dragOrigin = position;
        } else if (navigationAction === 'update-drag') {
            // update-drag maintains existing drag state but starts if not dragging
            isDragging = true;
            // Keep existing dragType and dragOrigin if already set, otherwise set based on component
            if (!dragType) {
                dragType = componentType === 'cell' ? 'cell' :
                          (position as HeaderPosition).headerType === 'row' ? 'row' : 'col';
                dragOrigin = position;
            }
        } else if (navigationAction === 'end-drag') {
            isDragging = false;
            dragType = undefined;
            dragOrigin = undefined;
        }
        // 'continue-drag' and 'none' maintain current state

        // Update context
        this.store.updateDraggingActionContext({
            dragType,
            dragOrigin,
        });
    }

    // Navigation mode control
    activateNavigation(): boolean {
        this.store.setNavigationMode(true);
        this.viewportPort?.focusContainer();
        return true;
    }

    deactivateNavigation(): boolean {
        this.store.setNavigationMode(false);
        this.store.clearMousePosition();
        // Study isDragging reset here
        this.store.setDragging(false);
        return false;
    }

    // Getters and setters for navigation state

    // Anchor management for rectangular selection
    setAnchor(position: GridPosition): void {
        this.store.setAnchorPosition(position);
    }

    getAnchor(): GridPosition {
        return this.store.getAnchorPosition();
    }

    setMousePosition(position: GridPosition | HeaderPosition): void {
        this.store.setMousePosition(position);
    }

    getCurrentPosition(): GridPosition {
        return this.store.getPointerPosition();
    }


    //============ Navigation utility methods for programmatic movement ================

    /**
     * Navigate to the next cell to the right within grid bounds
     * @returns New position or current position if at boundary
     */
    navigateToNextRightCell(): GridPosition {
        const currentPosition = this.getCurrentPosition();
        const { maxCol } = this.gridDimensions;

        if (currentPosition.col < maxCol) {
            const newPosition = { row: currentPosition.row, col: currentPosition.col + 1 };
            this.movePointer(newPosition);
            this.setAnchor(newPosition); // Update anchor to follow pointer
            return newPosition;
        }

        return currentPosition; // Already at rightmost boundary
    }

    /**
     * Navigate to the next cell down within grid bounds
     * @returns New position or current position if at boundary
     */
    navigateToNextDownCell(): GridPosition {
        const currentPosition = this.getCurrentPosition();
        const { maxRow } = this.gridDimensions;

        if (currentPosition.row < maxRow) {
            const newPosition = { row: currentPosition.row + 1, col: currentPosition.col };
            this.movePointer(newPosition);
            this.setAnchor(newPosition); // Update anchor to follow pointer
            return newPosition;
        }

        return currentPosition; // Already at bottom boundary
    }

    /**
     * Navigate to the next cell to the left within grid bounds
     * @returns New position or current position if at boundary
     */
    navigateToNextLeftCell(): GridPosition {
        const currentPosition = this.getCurrentPosition();

        if (currentPosition.col > 0) {
            const newPosition = { row: currentPosition.row, col: currentPosition.col - 1 };
            this.movePointer(newPosition);
            this.setAnchor(newPosition); // Update anchor to follow pointer
            return newPosition;
        }

        return currentPosition; // Already at leftmost boundary
    }

    /**
     * Navigate to the next cell up within grid bounds
     * @returns New position or current position if at boundary
     */
    navigateToNextUpCell(): GridPosition {
        const currentPosition = this.getCurrentPosition();

        if (currentPosition.row > 0) {
            const newPosition = { row: currentPosition.row - 1, col: currentPosition.col };
            this.movePointer(newPosition);
            this.setAnchor(newPosition); // Update anchor to follow pointer
            return newPosition;
        }

        return currentPosition; // Already at top boundary
    }

    /**
     * Navigate to next cell, if no cell to the right, go to first cell of next row
     * @returns New position or current position if at bottom-right boundary
     */
    navigateToNextCell(): GridPosition {
        const currentPosition = this.getCurrentPosition();
        const { maxRow, maxCol } = this.gridDimensions;
        if (currentPosition.col < maxCol) {
            return this.navigateToNextRightCell();
        } else if (currentPosition.row < maxRow) {
            const newPosition = { row: currentPosition.row + 1, col: 0 };
            this.movePointer(newPosition);
            this.setAnchor(newPosition);
            return newPosition;
        }
        return currentPosition;
    }

    /**
     * Navigate to previous cell, if no cell to the left, go to last cell of previous row
     * @returns New position or current position if at top-left boundary
     */
    navigateToPreviousCell(): GridPosition {
        const currentPosition = this.getCurrentPosition();
        if (currentPosition.col > 0) {
            return this.navigateToNextLeftCell();
        }
        else if (currentPosition.row > 0) {
            const { maxCol } = this.gridDimensions;
            const newPosition = { row: currentPosition.row - 1, col: maxCol };
            this.movePointer(newPosition);
            this.setAnchor(newPosition);
            return newPosition;
        }
        return currentPosition;
    }

    isNavigationMode(): boolean {
        return this.store.isNavigationMode();
    }

    isDragging(): boolean {
        return this.store.isDragging();
    }

    /**
     * Get deep copy of navigation anchors and pointers for selection operations
     * Returns only the positions needed for selection logic
     */
    getNavigationAnchorsAndPointers(): NavigationAnchorsAndPointers {
        return this.store.getNavigationAnchorsAndPointers();
    }

    // ==================== HEADER NAVIGATION METHODS ====================

    // Combined getter for SelectionHandler
    getHeaderNavigationState(): {
        rowAnchor?: number;
        rowPointer?: number;
        colAnchor?: number;
        colPointer?: number;
    } {
        return this.store.getHeaderNavigationState();
    }

    // Navigation APIs that take functions aware of cell structure
    /**
     * Navigate to the first cell that matches the given condition
     * @param cellMatcher Function that receives a cell component and returns true if it matches
     * @returns True if navigation occurred, false if no matching cell found
     */
    navigateToFirst(
        cellMatcher: (cell: CellComponent<TExtraProps>) => boolean
    ): boolean {
        const { maxRow, maxCol } = this.gridDimensions;

        // Search in reading order: top to bottom, left to right
        for (let row = 0; row <= maxRow; row++) {
            for (let col = 0; col <= maxCol; col++) {
                const key = `${row}-${col}`;
                const cell = this.cellComponents.get(key);

                if (cell && cellMatcher(cell)) {
                    const targetPosition = { row, col };
                    this.movePointer(targetPosition);
                    this.setAnchor(targetPosition);
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Navigate to the next cell (from current position) that matches the given condition
     * Searches in reading order: left to right, top to bottom
     * @param cellMatcher Function that receives a cell component and returns true if it matches
     * @returns True if navigation occurred, false if no matching cell found
     */
    navigateToNext(
        cellMatcher: (cell: CellComponent<TExtraProps>) => boolean
    ): boolean {
        const currentPosition = this.getCurrentPosition();
        const { maxRow, maxCol } = this.gridDimensions;

        // Start from the next position after current
        let startRow = currentPosition.row;
        let startCol = currentPosition.col + 1;

        // If we're at the end of the row, go to next row
        if (startCol > maxCol) {
            startRow++;
            startCol = 0;
        }

        // Search from current position forward
        for (let row = startRow; row <= maxRow; row++) {
            for (let col = (row === startRow ? startCol : 0); col <= maxCol; col++) {
                const key = `${row}-${col}`;
                const cell = this.cellComponents.get(key);

                if (cell && cellMatcher(cell)) {
                    const targetPosition = { row, col };
                    this.movePointer(targetPosition);
                    this.setAnchor(targetPosition);
                    return true;
                }
            }
        }

        return false;
    }

    // Dragging Action Context management
    getDraggingActionContext(): DraggingActionContext {
        return {
            ...this.store.getDraggingActionContext(),
            isOutsideDragging: this.autoScrollManager.isOutsideDragging(),
            outsideDraggingState: this.autoScrollManager.getOutsideDraggingState(),
        };
    }

    /**
     * Synchronize resulting active selection from a deselection with respective
     * pointer and anchor positions.
     * This is needed because SelectionHandler does not manage pointer/anchor state.
     */
    synchronizeSelectionPointerAndAnchor(resultingActiveSelection: 'cell' | 'header-row' | 'header-col' | null,
            anchor: GridPosition | number, pointer: GridPosition | number, visibleArea?: RenderArea): void {
        if (resultingActiveSelection === 'cell' && typeof anchor === 'object' && typeof pointer === 'object') {
            this.setAnchor(anchor);
            this.movePointer(pointer);
        } else if (resultingActiveSelection === 'header-row' && typeof anchor === 'number' && typeof pointer === 'number') {
            this.store.setHeaderAnchorRow(anchor);
            this.store.setHeaderPointerRow(pointer);
            if (visibleArea) {
                const cellForHeader = visibleArea ? { row: pointer, col: visibleArea.startCol } : { row: pointer, col: 0 };
                this.movePointer(cellForHeader);
            }
        } else if (resultingActiveSelection === 'header-col' && typeof anchor === 'number' && typeof pointer === 'number') {
            this.store.setHeaderAnchorCol(anchor);
            this.store.setHeaderPointerCol(pointer);
            if (visibleArea) {
                const cellForHeader = visibleArea ? { row: visibleArea.startRow, col: pointer } : { row: 0, col: pointer };
                this.movePointer(cellForHeader);
            }
        } // If null or mismatched types, do nothing
    }
}
