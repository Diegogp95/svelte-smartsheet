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
    OutsideScrollAnalysis,
    RenderArea,
    KeyboardNavigationAnalysis,
} from './types';

export type PointerPositionCallback = (handler: NavigationHandler<any, any, any>) => void;
export type DocumentMouseMoveCallback = (event: MouseEvent) => void;
export type AutoScrollSelectionCallback = (position: GridPosition, draggingContext: DraggingActionContext) => void;

export default class NavigationHandler<TExtraProps = undefined, TRowHeaderProps = undefined, TColHeaderProps = undefined> {
    private gridDimensions: GridDimensions;
    private navigationState: NavigationState;
    // Container references
    private tableContainer: HTMLDivElement | undefined;
    private mainGridContainer: HTMLDivElement | undefined;

    private columnsHeaderContainer: HTMLDivElement | undefined;
    private rowsHeaderContainer: HTMLDivElement | undefined;
    private cellComponents: Map<string, CellComponent<TExtraProps>>;
    private pointerPositionCallback?: PointerPositionCallback;
    // Separate header components by type
    private rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>;
    private colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>;
    private cornerHeaderComponent: HeaderComponent | null;

    // Grid spacing data
    private rowHeights: number[] = [];
    private colWidths: number[] = [];

    // Outside dragging listeners
    private tableMouseEnterListener?: (event: MouseEvent) => void;
    private tableMouseLeaveListener?: (event: MouseEvent) => void;
    private documentMouseMoveListener?: (event: MouseEvent) => void;
    private documentMouseMoveCallback?: DocumentMouseMoveCallback;
    private autoScrollSelectionCallback?: AutoScrollSelectionCallback;

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
        this.navigationState = {
            pointerPosition: { row: 0, col: 0 },
            anchorPosition: { row: 0, col: 0 },
            navigationMode: false,
            // Initialize header navigation states
            headerAnchorRow: 0,
            headerPointerRow: 0,
            headerAnchorCol: 0,
            headerPointerCol: 0,
            isDragging: false,
            draggingContext: {
                isOutsideDragging: false,
                outsideDraggingState: undefined,
                activeTimers: undefined,
            },
        };
        this.pointerPositionCallback = pointerPositionCallback;
        this.documentMouseMoveCallback = documentMouseMoveCallback;
        this.autoScrollSelectionCallback = autoScrollSelectionCallback;
    }

    // Update container reference
    setTableContainer(container: HTMLDivElement) {
        this.tableContainer = container;
    }

    setMainGridContainer(container: HTMLDivElement) {
        this.mainGridContainer = container;
    }

    getMainGridContainer(): HTMLDivElement | undefined {
        return this.mainGridContainer;
    }

    getTableContainer(): HTMLDivElement | undefined {
        return this.tableContainer;
    }

    // set grid spacing data
    setRowHeights(heights: number[]) {
        this.rowHeights = heights;
    }

    setColWidths(widths: number[]) {
        this.colWidths = widths;
    }

    // Update header containers references
    setColumnsHeaderContainer(container: HTMLDivElement) {
        this.columnsHeaderContainer = container;
    }

    setRowsHeaderContainer(container: HTMLDivElement) {
        this.rowsHeaderContainer = container;
    }

    // Update grid dimensions
    updateGridDimensions(dimensions: GridDimensions) {
        this.gridDimensions = dimensions;
    }

    // Move pointer to specific position
    movePointer(position: GridPosition): GridPosition {
        const { maxRow, maxCol } = this.gridDimensions;

        if (position.row >= 0 && position.row <= maxRow &&
            position.col >= 0 && position.col <= maxCol) {
            this.setPointerPosition(position);

            // Auto-scroll if container is available
            if (this.tableContainer) {
                this.scrollToPosition(position);
            }
        }

        // Call pointer position callback if defined
        if (this.pointerPositionCallback) {
            this.pointerPositionCallback(this);
        }

        return this.getCurrentPosition(); // Return current position if out of bounds
    }

    //========================== HELPER METHODS FOR POSITION CALCULATION ==========================//

    /**
     * Advances the page in the specified direction.
     * @param direction The direction to advance the page ('up', 'down', 'left', 'right').
     * @returns The new grid position after advancing the page.
     * This method delegates the scroll action to movePointer after calculating the new position.
     * This works for now, but it does not work just like Excel's page up/down behavior. We might need to revisit this later.
     */
    private advancePage(direction: string | null): GridPosition {
        const currentPosition = this.getCurrentPosition();
        let newPosition = { ...currentPosition };

        switch (direction) {
            case 'page-up':
                newPosition.row = this.calculateVerticalPage(currentPosition.row, 'up');
                break;
            case 'page-down':
                newPosition.row = this.calculateVerticalPage(currentPosition.row, 'down');
                break;
            case 'page-left':
                newPosition.col = this.calculateHorizontalPage(currentPosition.col, 'left');
                break;
            case 'page-right':
                newPosition.col = this.calculateHorizontalPage(currentPosition.col, 'right');
                break;
            default:
                // Unknown direction, return current position
                return currentPosition;
        }

        return newPosition;
    }

    private advanceHeaderPage(headerType: 'row' | 'col', direction: 'page-up' | 'page-down' | 'page-left' | 'page-right'): number {
        if (headerType === 'row') {
            // For row headers, only vertical navigation makes sense, so interpret page-left as 'page-up' and page-right as 'page-down'
            if (direction === 'page-up' || direction === 'page-left') {
                return this.calculateVerticalPage(this.getHeaderPointerRow(), 'up');
            } else if (direction === 'page-down' || direction === 'page-right') {
                return this.calculateVerticalPage(this.getHeaderPointerRow(), 'down');
            }
            return this.getHeaderPointerRow(); // No change for horizontal directions
        } else {
            // For col headers, only horizontal navigation makes sense
            if (direction === 'page-left' || direction === 'page-up') {
                return this.calculateHorizontalPage(this.getHeaderPointerCol(), 'left');
            } else if (direction === 'page-right' || direction === 'page-down') {
                return this.calculateHorizontalPage(this.getHeaderPointerCol(), 'right');
            }
            return this.getHeaderPointerCol(); // No change for vertical directions
        }
    }

    private singleCellStep(position: GridPosition, direction: 'up' | 'down' | 'left' | 'right'): GridPosition {
        const { row, col } = position;
        const { maxRow, maxCol } = this.gridDimensions;
        let newPosition = { row, col };
        switch (direction) {
            case 'up':
                if (row > 0) newPosition.row = row - 1;
                break;
            case 'down':
                if (row < maxRow) newPosition.row = row + 1;
                break;
            case 'left':
                if (col > 0) newPosition.col = col - 1;
                break;
            case 'right':
                if (col < maxCol) newPosition.col = col + 1;
                break;
            default:
                break;
        }
        return newPosition;
    }

    private singleHeaderStep(index: number, direction: 'up' | 'down' | 'left' | 'right', headerType: 'row' | 'col'): number {
        const { maxRow, maxCol } = this.gridDimensions;
        let newIndex = index;
        switch (headerType) {
            case 'row':
                if (direction === 'up' || direction === 'left' && index > 0) {
                    newIndex = index - 1;
                } else if (direction === 'down' || direction === 'right' && index < maxRow) {
                    newIndex = index + 1;
                }
                break;
            case 'col':
                if (direction === 'up' || direction === 'left' && index > 0) {
                    newIndex = index - 1;
                } else if (direction === 'down' || direction === 'right' && index < maxCol) {
                    newIndex = index + 1;
                }
                break;
            default:
                break;
        }
        return newIndex;
    }

    private boundaryHeaderJump(index: number, direction: 'up' | 'down' | 'left' | 'right', headerType: 'row' | 'col'): number {
        const { maxRow, maxCol } = this.gridDimensions;
        let newIndex = index;
        switch (headerType) {
            case 'row':
                if (direction === 'up' || direction === 'left') {
                    newIndex = 0;
                } else if (direction === 'down' || direction === 'right') {
                    newIndex = maxRow;
                }
                break;
            case 'col':
                if (direction === 'up' || direction === 'left') {
                    newIndex = 0;
                } else if (direction === 'down' || direction === 'right') {
                    newIndex = maxCol;
                }
                break;
            default:
                break;
        }
        return newIndex;
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
                    newCellPos = this.singleCellStep(cellPointer, direction as 'up' | 'down' | 'left' | 'right');
                    this.movePointer(newCellPos);
                } else if (navigationType === 'boundary' && direction) {
                    newCellPos = this.findDataBoundary(cellPointer.row, cellPointer.col, direction as 'up' | 'down' | 'left' | 'right');
                    this.movePointer(newCellPos);
                } else if (navigationType === 'page' && direction) {
                    newCellPos = this.advancePage(direction);
                    this.movePointer(newCellPos);
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
                    const currentHeaderIndex = headerType === 'row' ? this.getHeaderPointerRow() : this.getHeaderPointerCol();
                    let newHeaderIndex: number;

                    if (navigationType === 'single' && direction) {
                        newHeaderIndex = this.singleHeaderStep(currentHeaderIndex, direction as 'up' | 'down' | 'left' | 'right', headerType);
                    } else if (navigationType === 'boundary' && direction) {
                        newHeaderIndex = this.boundaryHeaderJump(currentHeaderIndex, direction as 'up' | 'down' | 'left' | 'right', headerType);
                    } else if (navigationType === 'page' && direction) {
                        // Page navigation for headers using specialized method
                        newHeaderIndex = this.advanceHeaderPage(headerType, direction as 'page-up' | 'page-down' | 'page-left' | 'page-right');
                    } else {
                        // Fallback: no navigation
                        newHeaderIndex = currentHeaderIndex;
                    }

                    // Update header pointer
                    if (headerType === 'row') {
                        this.setHeaderPointerRow(newHeaderIndex);
                        // Update cell pointer to reflect header selection (similar to processMouseNavigation)
                        const cellForHeader = visibleArea ? { row: newHeaderIndex, col: visibleArea.startCol } : { row: newHeaderIndex, col: 0 };
                        this.movePointer(cellForHeader);
                    } else {
                        this.setHeaderPointerCol(newHeaderIndex);
                        // Update cell pointer to reflect header selection (similar to processMouseNavigation)
                        const cellForHeader = visibleArea ? { row: visibleArea.startRow, col: newHeaderIndex } : { row: 0, col: newHeaderIndex };
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
                this.setDragging(true);

                // Setup outside dragging listeners
                this.setupTableOutsideListeners();
                break;

            case 'start-row-drag':
                const headerRowPos = position as HeaderPosition;
                // Set header navigation states
                this.setHeaderAnchorRow(headerRowPos.index);
                this.setHeaderPointerRow(headerRowPos.index);
                this.setDragging(true);

                // determine the first visible cell of the row and move pointer there
                const firstVisibleRowCell = visibleArea ? { row: headerRowPos.index, col: visibleArea.startCol } : undefined;
                if (firstVisibleRowCell) {
                    this.movePointer(firstVisibleRowCell);
                }

                // Setup outside dragging listeners
                this.setupTableOutsideListeners();
                break;

            case 'start-col-drag':
                // Column drag: Set header navigation states
                const headerColPos = position as HeaderPosition;
                // Set header navigation states
                this.setHeaderAnchorCol(headerColPos.index);
                this.setHeaderPointerCol(headerColPos.index);
                this.setDragging(true);

                // determine the first visible cell of the column and move pointer there
                const firstVisibleColCell = visibleArea ? { row: visibleArea.startRow, col: headerColPos.index } : undefined;
                if (firstVisibleColCell) {
                    this.movePointer(firstVisibleColCell);
                }

                // Setup outside dragging listeners
                this.setupTableOutsideListeners();
                break;

            case 'update-drag':
                // Shift+mousedown: Update pointer to extend active selection
                // Anchor remains from previous selection
                if (componentType === 'cell') {
                    // Cell update-drag
                    const cellPosition = position as GridPosition;
                    this.movePointer(cellPosition);
                    this.setDragging(true);
                } else {
                    // Header update-drag
                    if ((position as HeaderPosition).headerType === 'row') {
                        const headerRowPos = position as HeaderPosition;
                        this.setHeaderPointerRow(headerRowPos.index);
                        this.setDragging(true);
                    } else {
                        const headerColPos = position as HeaderPosition;
                        this.setHeaderPointerCol(headerColPos.index);
                        this.setDragging(true);
                    }
                }

                // Setup outside dragging listeners
                this.setupTableOutsideListeners();
                break;

            case 'continue-drag':
                // Check if we are in outside dragging mode
                if (context.isOutsideDragging) {
                    // Process outside scroll analysis if available
                    if (analysis.outsideScrollAnalysis) {
                        const scrollAnalysis = analysis.outsideScrollAnalysis;

                        // Update outside dragging state with scroll analysis
                        const outsideDraggingState: OutsideScrollAnalysis = {
                            direction: scrollAnalysis.direction,
                            intervals: {
                                row: scrollAnalysis.intervals.row,
                                col: scrollAnalysis.intervals.col
                            },
                            edges: scrollAnalysis.edges,
                            distances: scrollAnalysis.distances
                        };

                        // Update dragging context
                        this.updateDraggingActionContext({
                            outsideDraggingState
                        });

                        // Update auto-scroll timers based on scroll analysis
                        this.updateAutoScrollTimers(scrollAnalysis);
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
                        this.setHeaderPointerRow(cellPos.row);
                        // determine the first visible cell of the row and move pointer there
                        const firstVisibleRowCell = visibleArea ? { row: cellPos.row, col: visibleArea.startCol } : undefined;
                        if (firstVisibleRowCell) {
                            this.movePointer(firstVisibleRowCell);
                        }
                    } else if (context.dragType === 'col') {
                        // Col drag over cell: actualizar pointer de col
                        const cellPos = position as GridPosition;
                        this.setHeaderPointerCol(cellPos.col);
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
                        this.setHeaderPointerRow(rowHeaderPos.index);
                        // determine the first visible cell of the row and move pointer there
                        const firstVisibleRowCell = visibleArea ? { row: rowHeaderPos.index, col: visibleArea.startCol } : undefined;
                        if (firstVisibleRowCell) {
                            this.movePointer(firstVisibleRowCell);
                        }
                    } else if (context.dragType === 'col') {
                        // Col drag over header: actualizar pointer de col
                        const colHeaderPos = position as HeaderPosition;
                        this.setHeaderPointerCol(colHeaderPos.index);
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
                    this.setDragging(false);

                    // Cleanup outside dragging listeners
                    this.removeTableOutsideListeners();
                    this.removeDocumentMouseMoveListener();

                    // Clear auto-scroll timers
                    this.clearAutoScrollTimers();

                    // Reset outside dragging state
                    this.updateDraggingActionContext({
                        isOutsideDragging: false,
                        outsideDraggingState: undefined,
                        activeTimers: undefined
                    });
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

    // Helper method: Get selection range for entire row
    private getRowSelectionRange(rowIndex: number): { start: GridPosition; end: GridPosition } {
        const { maxCol } = this.gridDimensions;
        return {
            start: { row: rowIndex, col: 0 },
            end: { row: rowIndex, col: maxCol }
        };
    }

    // Helper method: Get selection range for entire column
    private getColumnSelectionRange(colIndex: number): { start: GridPosition; end: GridPosition } {
        const { maxRow } = this.gridDimensions;
        return {
            start: { row: 0, col: colIndex },
            end: { row: maxRow, col: colIndex }
        };
    }

    // Update mouse action context based on processed analysis
    updateMouseActionContextFromAnalysis(analysis: MouseEventAnalysis): void {
        const { type, position, navigationAction, componentType } = analysis;

        // Determine drag state based on navigation action
        let isDragging = this.navigationState.isDragging;
        let dragType = this.navigationState.draggingContext.dragType;
        let dragOrigin = this.navigationState.draggingContext.dragOrigin;

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
        this.updateDraggingActionContext({
            dragType,
            dragOrigin,
        });
    }

    comparePositions(pos1: GridPosition, pos2: GridPosition): boolean {
        return pos1.row === pos2.row && pos1.col === pos2.col;
    }

    // Helper methods for Ctrl+Arrow navigation (Excel-like boundary detection)
    private isCellEmpty(position: GridPosition): boolean {
        const key = `${position.row}-${position.col}`;
        const cellComponent = this.cellComponents.get(key);
        if (!cellComponent) return true;

        const value = cellComponent.value;
        return value === '' || value === null || value === undefined;
    }

    private findDataBoundary(currentRow: number, currentCol: number, direction: 'up' | 'down' | 'left' | 'right'): GridPosition {
        const { maxRow, maxCol } = this.gridDimensions;
        const currentEmpty = this.isCellEmpty({ row: currentRow, col: currentCol });

        // Define direction vectors and boundaries
        const directions = {
            up: { rowDelta: -1, colDelta: 0, boundary: { row: 0, col: currentCol } },
            down: { rowDelta: 1, colDelta: 0, boundary: { row: maxRow, col: currentCol } },
            left: { rowDelta: 0, colDelta: -1, boundary: { row: currentRow, col: 0 } },
            right: { rowDelta: 0, colDelta: 1, boundary: { row: currentRow, col: maxCol } }
        };

        const { rowDelta, colDelta, boundary } = directions[direction];

        if (currentEmpty) {
            // Find first non-empty cell in direction
            let row = currentRow + rowDelta;
            let col = currentCol + colDelta;

            while (row >= 0 && row <= maxRow && col >= 0 && col <= maxCol) {
                if (!this.isCellEmpty({ row, col })) {
                    return { row, col };
                }
                row += rowDelta;
                col += colDelta;
            }
            // No data found, go to boundary
            return boundary;
        } else {
            // Find last data cell before empty region or boundary
            let row = currentRow + rowDelta;
            let col = currentCol + colDelta;

            while (row >= 0 && row <= maxRow && col >= 0 && col <= maxCol) {
                if (this.isCellEmpty({ row, col })) {
                    // Found empty cell, return previous data cell
                    return { row: row - rowDelta, col: col - colDelta };
                }
                row += rowDelta;
                col += colDelta;
            }
            // No empty cell found, go to boundary
            return boundary;
        }
    }

    // Automatic scroll to keep pointer visible
    private scrollToPosition(position: GridPosition): void {
        if (!this.tableContainer) return;

        // Container dimensions and scroll positions
        const container = this.tableContainer;
        const scrollTop = container.scrollTop;
        const scrollLeft = container.scrollLeft;
        const containerHeight = container.clientHeight;
        const containerWidth = container.clientWidth;

        // Calculate the cumulative offsets to the target cell
        // Since rowHeights' and colWidths' first element corresponds to the header row/col dimension,
        // we need to offset by one index when calculating positions
        // following variables only represent the values of the main grid, not including headers
        // but we need to adjust the container dimensions and scroll positions to account for headers offset
        const cellTop = this.rowHeights.slice(1, position.row+1).reduce((sum, h) => sum + h, 0);
        const cellLeft = this.colWidths.slice(1, position.col+1).reduce((sum, w) => sum + w, 0);
        const cellBottom = cellTop + (this.rowHeights[position.row+1] || 0); // Default height if undefined
        const cellRight = cellLeft + (this.colWidths[position.col+1] || 0); // Default width if undefined

        // Adjust container dimensions to account for headers
        const effectiveContainerHeight = containerHeight - (this.rowHeights[0] || 0);
        const effectiveContainerWidth = containerWidth - (this.colWidths[0] || 0);

        let newScrollTop = scrollTop;
        let newScrollLeft = scrollLeft;
        if (cellTop < scrollTop) {
            // Cell is above the visible area, scroll up
            newScrollTop = cellTop;
        } else if (cellBottom > scrollTop + effectiveContainerHeight) {
            // Cell is below the visible area, scroll down
            newScrollTop = cellBottom - effectiveContainerHeight;
        }
        if (cellLeft < scrollLeft) {
            // Cell is left of the visible area, scroll left
            newScrollLeft = cellLeft;
        } else if (cellRight > scrollLeft + effectiveContainerWidth) {
            // Cell is right of the visible area, scroll right
            newScrollLeft = cellRight - effectiveContainerWidth;
        }

        // Apply smooth scroll if there are changes
        if (newScrollTop !== scrollTop || newScrollLeft !== scrollLeft) {
            container.scrollTo({
                top: Math.max(0, newScrollTop), // Ensure we don't scroll to negative values
                left: Math.max(0, newScrollLeft),
                behavior: 'smooth'
            });
        }
    }

    // Navigation mode control
    activateNavigation(): boolean {
        this.navigationState.navigationMode = true;
        if (this.tableContainer) {
            this.tableContainer.focus();
        }
        return true;
    }

    deactivateNavigation(): boolean {
        this.navigationState.navigationMode = false;
        this.clearMousePosition();
        // Study isDragging reset here
        this.setDragging(false);
        return false;
    }

    // Getters and setters for navigation state

    // Anchor management for rectangular selection
    setAnchor(position: GridPosition): void {
        this.navigationState.anchorPosition = { ...position };
    }

    getAnchor(): GridPosition {
        return this.navigationState.anchorPosition;
    }

    setMousePosition(position: GridPosition | HeaderPosition): void {
        this.navigationState.mousePosition = { ...position };
    }

    getMousePosition(): GridPosition | HeaderPosition | undefined {
        return this.navigationState.mousePosition ? { ...this.navigationState.mousePosition } : undefined;
    }

    clearMousePosition(): void {
        this.navigationState.mousePosition = undefined;
    }

    setPointerPosition(position: GridPosition): void {
        this.navigationState.pointerPosition = { ...position };
    }

    getCurrentPosition(): GridPosition {
        return { ...this.navigationState.pointerPosition };
    }


    //========================= Page Calculation Methods =========================//

    /**
     * Vertical page calculator
     * @returns New row index after page navigation
     */

    private calculateVerticalPage(currentRow: number, direction: 'up' | 'down'): number {
        const { maxRow } = this.gridDimensions;
        if (!this.tableContainer || !this.mainGridContainer) {
            return currentRow;
        }

        const currentScrollTop = this.tableContainer.scrollTop;
        const effectiveContainerHeight = this.tableContainer.clientHeight - (this.rowHeights[0] || 0);
        let newScrollTop: number;

        // Calculate new scroll position based on direction
        if (direction === 'up') {
            newScrollTop = Math.max(0, currentScrollTop - effectiveContainerHeight);
        } else {
            // Optimized max scroll calculation using mainGridContainer
            const maxScrollTop = Math.max(0, this.mainGridContainer.clientHeight - effectiveContainerHeight);
            newScrollTop = Math.min(maxScrollTop, currentScrollTop + effectiveContainerHeight);
        }

        // Convert scroll position to row index
        if (direction === 'up') {
            // For up: find first row that starts after newScrollTop (same as before)
            let accumulatedHeight = 0;
            for (let row = 0; row <= maxRow; row++) {
                const rowHeight = this.rowHeights[row + 1] || 32; // +1 because first element is header
                if (accumulatedHeight + rowHeight > newScrollTop) {
                    return Math.max(0, Math.min(maxRow, row));
                }
                accumulatedHeight += rowHeight;
            }
            return maxRow;
        } else {
            // For down: find last row that fits completely within visible area
            let accumulatedHeight = 0;
            let lastCompleteRow = 0;

            for (let row = 0; row <= maxRow; row++) {
                const rowHeight = this.rowHeights[row + 1] || 32;
                if (accumulatedHeight + rowHeight <= newScrollTop + effectiveContainerHeight) {
                    lastCompleteRow = row;
                }
                accumulatedHeight += rowHeight;
                if (accumulatedHeight > newScrollTop + effectiveContainerHeight) {
                    break;
                }
            }
            return Math.max(0, Math.min(maxRow, lastCompleteRow));
        }
    }

    /**
     * Horizontal page calculator
     * @returns New column index after page navigation
     */
    private calculateHorizontalPage(currentCol: number, direction: 'left' | 'right'): number {
        const { maxCol } = this.gridDimensions;
        if (!this.tableContainer || !this.mainGridContainer) {
            return currentCol;
        }

        const currentScrollLeft = this.tableContainer.scrollLeft;
        const effectiveContainerWidth = this.tableContainer.clientWidth - (this.colWidths[0] || 0);
        let newScrollLeft: number;

        // Calculate new scroll position based on direction
        if (direction === 'left') {
            newScrollLeft = Math.max(0, currentScrollLeft - effectiveContainerWidth);
        } else {
            // Optimized max scroll calculation using mainGridContainer
            const maxScrollLeft = Math.max(0, this.mainGridContainer.clientWidth - effectiveContainerWidth);
            newScrollLeft = Math.min(maxScrollLeft, currentScrollLeft + effectiveContainerWidth);
        }

        // Convert scroll position to column index
        if (direction === 'left') {
            // For left: find first column that starts after newScrollLeft (same as before)
            let accumulatedWidth = 0;
            for (let col = 0; col <= maxCol; col++) {
                const colWidth = this.colWidths[col + 1] || 120; // +1 because first element is header
                if (accumulatedWidth + colWidth > newScrollLeft) {
                    return Math.max(0, Math.min(maxCol, col));
                }
                accumulatedWidth += colWidth;
            }
            return maxCol;
        } else {
            // For right: find last column that fits completely within visible area
            let accumulatedWidth = 0;
            let lastCompleteCol = 0;

            for (let col = 0; col <= maxCol; col++) {
                const colWidth = this.colWidths[col + 1] || 120;
                if (accumulatedWidth + colWidth <= newScrollLeft + effectiveContainerWidth) {
                    lastCompleteCol = col;
                }
                accumulatedWidth += colWidth;
                if (accumulatedWidth > newScrollLeft + effectiveContainerWidth) {
                    break;
                }
            }
            return Math.max(0, Math.min(maxCol, lastCompleteCol));
        }
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
        return this.navigationState.navigationMode;
    }

    isDragging(): boolean {
        return this.navigationState.isDragging;
    }

    setDragging(isDragging: boolean): void {
        this.navigationState.isDragging = isDragging;
    }

    getNavigationState(): NavigationState {
        return { ...this.navigationState };
    }

    /**
     * Get deep copy of navigation anchors and pointers for selection operations
     * Returns only the positions needed for selection logic
     */
    getNavigationAnchorsAndPointers(): NavigationAnchorsAndPointers {
        return {
            // Cell navigation state (deep copy)
            cellPointer: { ...this.navigationState.pointerPosition },
            cellAnchor: { ...this.navigationState.anchorPosition },

            // Header navigation states (primitive values, already copied by value)
            headerAnchorRow: this.navigationState.headerAnchorRow,
            headerPointerRow: this.navigationState.headerPointerRow,
            headerAnchorCol: this.navigationState.headerAnchorCol,
            headerPointerCol: this.navigationState.headerPointerCol
        };
    }

    // ==================== HEADER NAVIGATION METHODS ====================

    // Header Row Navigation
    setHeaderAnchorRow(row: number): void {
        this.navigationState.headerAnchorRow = row;
    }

    getHeaderAnchorRow(): number {
        return this.navigationState.headerAnchorRow;
    }

    setHeaderPointerRow(row: number): void {
        this.navigationState.headerPointerRow = row;
    }

    getHeaderPointerRow(): number {
        return this.navigationState.headerPointerRow;
    }

    // Header Column Navigation
    setHeaderAnchorCol(col: number): void {
        this.navigationState.headerAnchorCol = col;
    }

    getHeaderAnchorCol(): number {
        return this.navigationState.headerAnchorCol;
    }

    setHeaderPointerCol(col: number): void {
        this.navigationState.headerPointerCol = col;
    }

    getHeaderPointerCol(): number {
        return this.navigationState.headerPointerCol;
    }

    // Combined getter for SelectionHandler
    getHeaderNavigationState(): {
        rowAnchor?: number;
        rowPointer?: number;
        colAnchor?: number;
        colPointer?: number;
    } {
        return {
            rowAnchor: this.navigationState.headerAnchorRow,
            rowPointer: this.navigationState.headerPointerRow,
            colAnchor: this.navigationState.headerAnchorCol,
            colPointer: this.navigationState.headerPointerCol
        };
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
        return { ...this.navigationState.draggingContext };
    }

    setDraggingActionContext(context: DraggingActionContext): void {
        this.navigationState.draggingContext = { ...context };
    }

    updateDraggingActionContext(updates: Partial<DraggingActionContext>): void {
        this.navigationState.draggingContext = { ...this.navigationState.draggingContext, ...updates };
    }

    // ================== OUTSIDE DRAGGING METHODS ==================

    /**
     * Update auto-scroll timers based on outside scroll analysis
     * Uses estado centralizado + setTimeout recursivo approach
     */
    private updateAutoScrollTimers(analysis: OutsideScrollAnalysis): void {
        // Update dragging context with outside scroll analysis
        this.updateDraggingActionContext({
            outsideDraggingState: analysis
        });
        // Ensure timers are running
        this.ensureTimersRunning();
    }

    /**
     * Ensure auto-scroll timers are running based on current analysis
     * Creates timers only if they don't exist and directions are active
     */
    private ensureTimersRunning(): void {
        const timers = this.navigationState.draggingContext.activeTimers;
        const analysis = this.getCurrentAnalysis();

        if (!analysis) return;

        // Ensure timers object exists
        this.navigationState.draggingContext.activeTimers = timers || {};
        const activeTimers = this.navigationState.draggingContext.activeTimers!;

        // Start row timer if needed and not already running
        if (analysis.direction.row !== 0 && analysis.intervals.row && !activeTimers.rowTimerId) {
            this.startRecursiveRowTimer();
        }

        // Start col timer if needed and not already running
        if (analysis.direction.col !== 0 && analysis.intervals.col && !activeTimers.colTimerId) {
            this.startRecursiveColTimer();
        }

        // Stop timers if directions are no longer active
        if (analysis.direction.row === 0 && activeTimers.rowTimerId) {
            clearTimeout(activeTimers.rowTimerId);
            activeTimers.rowTimerId = undefined;
        }

        if (analysis.direction.col === 0 && activeTimers.colTimerId) {
            clearTimeout(activeTimers.colTimerId);
            activeTimers.colTimerId = undefined;
        }
    }

    /**
     * Get current scroll analysis from dragging context
     */
    private getCurrentAnalysis(): OutsideScrollAnalysis | undefined {
        return this.navigationState.draggingContext.outsideDraggingState;
    }

    /**
     * Clear all active auto-scroll timers (now using setTimeout)
     */
    private clearAutoScrollTimers(): void {
        const timers = this.navigationState.draggingContext.activeTimers;
        if (timers) {
            if (timers.rowTimerId) {
                clearTimeout(timers.rowTimerId);
            }
            if (timers.colTimerId) {
                clearTimeout(timers.colTimerId);
            }
            this.navigationState.draggingContext.activeTimers = undefined;
        }
    }

    /**
     * Start recursive row timer that reads current state for each execution
     * Uses setTimeout recursivo pattern
     */
    private startRecursiveRowTimer(): void {
        const executeRowScroll = () => {
            const analysis = this.getCurrentAnalysis();

            if (!analysis || analysis.direction.row === 0) {
                // Direction changed to 0, auto-stop timer
                const timers = this.navigationState.draggingContext.activeTimers;
                if (timers?.rowTimerId) {
                    timers.rowTimerId = undefined;
                }
                return;
            }

            // Execute scroll with current direction
            this.executeAutoScroll('row', analysis.direction.row);

            // Schedule next execution with current interval
            const nextInterval = analysis.intervals.row || 100;
            const timers = this.navigationState.draggingContext.activeTimers;
            if (timers) {
                timers.rowTimerId = window.setTimeout(executeRowScroll, nextInterval);
            }
        };

        // Start the recursive timer
        executeRowScroll();
    }

    /**
     * Start recursive col timer that reads current state for each execution
     * Uses setTimeout recursivo pattern
     */
    private startRecursiveColTimer(): void {
        const executeColScroll = () => {
            const analysis = this.getCurrentAnalysis();

            if (!analysis || analysis.direction.col === 0) {
                // Direction changed to 0, auto-stop timer
                const timers = this.navigationState.draggingContext.activeTimers;
                if (timers?.colTimerId) {
                    timers.colTimerId = undefined;
                }
                return;
            }

            // Execute scroll with current direction
            this.executeAutoScroll('col', analysis.direction.col);

            // Schedule next execution with current interval (dynamic!)
            const nextInterval = analysis.intervals.col || 100;
            const timers = this.navigationState.draggingContext.activeTimers;
            if (timers) {
                timers.colTimerId = window.setTimeout(executeColScroll, nextInterval);
            }
        };

        // Start the recursive timer
        executeColScroll();
    }

    /**
     * Execute auto-scroll by moving the pointer in the specified direction
     * Called by timer intervals during outside dragging
     * Handles different drag types (cell, row, col) based on current dragging context
     */
    private executeAutoScroll(dimension: 'row' | 'col', direction: number): void {
        // Read dragging context to determine behavior
        const context = this.navigationState.draggingContext;
        const dragType = context.dragType;

        // Behavior depends on the type of drag operation
        switch (dragType) {
            case 'cell':
                this.executeAutoScrollForCell(dimension, direction);
                break;
            case 'row':
                this.executeAutoScrollForRow(dimension, direction);
                break;
            case 'col':
                this.executeAutoScrollForCol(dimension, direction);
                break;
            default:
                // Fallback to cell behavior if dragType is undefined
                this.executeAutoScrollForCell(dimension, direction);
                break;
        }
    }

    /**
     * Execute auto-scroll for cell dragging (original behavior)
     * Updates pointerPosition based on direction
     */
    private executeAutoScrollForCell(dimension: 'row' | 'col', direction: number): void {
        const currentPos = this.navigationState.pointerPosition;
        const { maxRow, maxCol } = this.gridDimensions;

        let newPosition: GridPosition;

        if (dimension === 'row') {
            // Calculate new row position
            const newRow = Math.max(0, Math.min(maxRow, currentPos.row + direction));
            newPosition = { row: newRow, col: currentPos.col };
        } else {
            // Calculate new col position
            const newCol = Math.max(0, Math.min(maxCol, currentPos.col + direction));
            newPosition = { row: currentPos.row, col: newCol };
        }

        // Only move if position actually changed
        if (newPosition.row !== currentPos.row || newPosition.col !== currentPos.col) {
            this.movePointer(newPosition);

            // Trigger selection update via callback
            if (this.autoScrollSelectionCallback && this.isDragging()) {
                this.autoScrollSelectionCallback(newPosition, this.getDraggingActionContext());
            }
        }
    }

    /**
     * Execute auto-scroll for row header dragging
     * Updates headerPointerRow and syncs pointerPosition row component only
     */
    private executeAutoScrollForRow(dimension: 'row' | 'col', direction: number): void {
        // For row dragging, only vertical scrolling makes sense
        if (dimension !== 'row') {
            return;
        }

        const currentRowPointer = this.navigationState.headerPointerRow;
        const currentCellPos = this.navigationState.pointerPosition;
        const { maxRow } = this.gridDimensions;

        // Calculate new row pointer
        const newRowPointer = Math.max(0, Math.min(maxRow, currentRowPointer + direction));

        // Only update if position actually changed
        if (newRowPointer !== currentRowPointer) {
            // Update header row pointer
            this.setHeaderPointerRow(newRowPointer);

            // Sync cell pointer: only update the row, keep the same column
            const newCellPosition = { row: newRowPointer, col: currentCellPos.col };
            this.movePointer(newCellPosition);

            // Trigger selection update via callback
            if (this.autoScrollSelectionCallback && this.isDragging()) {
                this.autoScrollSelectionCallback(newCellPosition, this.getDraggingActionContext());
            }
        }
    }

    /**
     * Execute auto-scroll for column header dragging
     * Updates headerPointerCol and syncs pointerPosition column component only
     */
    private executeAutoScrollForCol(dimension: 'row' | 'col', direction: number): void {
        // For column dragging, only horizontal scrolling makes sense
        if (dimension !== 'col') {
            return;
        }

        const currentColPointer = this.navigationState.headerPointerCol;
        const currentCellPos = this.navigationState.pointerPosition;
        const { maxCol } = this.gridDimensions;

        // Calculate new column pointer
        const newColPointer = Math.max(0, Math.min(maxCol, currentColPointer + direction));

        // Only update if position actually changed
        if (newColPointer !== currentColPointer) {
            // Update header column pointer
            this.setHeaderPointerCol(newColPointer);

            // Sync cell pointer: only update the column, keep the same row
            const newCellPosition = { row: currentCellPos.row, col: newColPointer };
            this.movePointer(newCellPosition);

            // Trigger selection update via callback
            if (this.autoScrollSelectionCallback && this.isDragging()) {
                this.autoScrollSelectionCallback(newCellPosition, this.getDraggingActionContext());
            }
        }
    }

    /**
     * Setup listeners for table mouse enter/leave events during drag operations
     */
    private setupTableOutsideListeners(): void {
        if (!this.tableContainer) {
            console.warn('[NavigationHandler] No table container available for outside listeners');
            return;
        }

        // Create bound handler functions
        this.tableMouseEnterListener = this.handleTableMouseEnter;
        this.tableMouseLeaveListener = this.handleTableMouseLeave;

        // Add listeners to table container
        this.tableContainer.addEventListener('mouseenter', this.tableMouseEnterListener);
        this.tableContainer.addEventListener('mouseleave', this.tableMouseLeaveListener);
    }

    /**
     * Remove listeners for table mouse enter/leave events
     */
    private removeTableOutsideListeners(): void {
        if (!this.tableContainer || !this.tableMouseEnterListener || !this.tableMouseLeaveListener) {
            return;
        }

        // Remove listeners from table container
        this.tableContainer.removeEventListener('mouseenter', this.tableMouseEnterListener);
        this.tableContainer.removeEventListener('mouseleave', this.tableMouseLeaveListener);

        // Clear references
        this.tableMouseEnterListener = undefined;
        this.tableMouseLeaveListener = undefined;
    }

    /**
     * Setup document mouse move listener with callback from controller
     */
    private setupDocumentMouseMoveListener(): void {
        if (!this.documentMouseMoveCallback) {
            console.warn('[NavigationHandler] No document mouse move callback available');
            return;
        }

        // Create bound listener using stored callback
        this.documentMouseMoveListener = this.documentMouseMoveCallback;

        // Add listener to document
        document.addEventListener('mousemove', this.documentMouseMoveListener);
    }

    /**
     * Remove document mouse move listener
     */
    private removeDocumentMouseMoveListener(): void {
        if (!this.documentMouseMoveListener) {
            return;
        }

        // Remove listener from document
        document.removeEventListener('mousemove', this.documentMouseMoveListener);

        // Clear listener reference but KEEP callback reference
        this.documentMouseMoveListener = undefined;
        // NOTE: documentMouseMoveCallback is kept for reuse
    }

    /**
     * Handle table mouse enter event - mouse enters table during drag
     */
    private handleTableMouseEnter = (event: MouseEvent): void => {
        // Clear auto-scroll timers when mouse re-enters table
        this.clearAutoScrollTimers();

        // Set outside dragging to false
        this.updateDraggingActionContext({
            isOutsideDragging: false
        });

        // Remove document mouse move listener
        this.removeDocumentMouseMoveListener();
    }

    /**
     * Handle table mouse leave event - mouse leaves table during drag
     */
    private handleTableMouseLeave = (event: MouseEvent): void => {
        // Set outside dragging to true
        this.updateDraggingActionContext({
            isOutsideDragging: true
        });
        // Setup document mouse move listener using stored callback
        this.setupDocumentMouseMoveListener();
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
            this.setHeaderAnchorRow(anchor);
            this.setHeaderPointerRow(pointer);
            if (visibleArea) {
                const cellForHeader = visibleArea ? { row: pointer, col: visibleArea.startCol } : { row: pointer, col: 0 };
                this.movePointer(cellForHeader);
            }
        } else if (resultingActiveSelection === 'header-col' && typeof anchor === 'number' && typeof pointer === 'number') {
            this.setHeaderAnchorCol(anchor);
            this.setHeaderPointerCol(pointer);
            if (visibleArea) {
                const cellForHeader = visibleArea ? { row: visibleArea.startRow, col: pointer } : { row: 0, col: pointer };
                this.movePointer(cellForHeader);
            }
        } // If null or mismatched types, do nothing
    }
}
