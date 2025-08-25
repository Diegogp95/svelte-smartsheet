import type {
    GridPosition,
    HeaderPosition,
    GridDimensions,
    NavigationState,
    CellComponent,
    NavigationAnalysis,
    HeaderComponent,
    DraggingActionContext,
    MouseEventAnalysis,
    OutsideScrollAnalysis,
} from './types';

export type PointerPositionCallback = (handler: NavigationHandler<any>) => void;
export type DocumentMouseMoveCallback = (event: MouseEvent) => void;
export type AutoScrollSelectionCallback = (position: GridPosition) => void;

export default class NavigationHandler<TExtraProps = undefined> {
    private gridDimensions: GridDimensions;
    private navigationState: NavigationState;
    private tableContainer: HTMLDivElement | undefined;
    private columnsHeaderContainer: HTMLDivElement | undefined;
    private rowsHeaderContainer: HTMLDivElement | undefined;
    private cellComponents: Map<string, CellComponent<TExtraProps>>;
    private pointerPositionCallback?: PointerPositionCallback;
    private headerComponents: Map<string, HeaderComponent>;

    // Outside dragging listeners
    private tableMouseEnterListener?: (event: MouseEvent) => void;
    private tableMouseLeaveListener?: (event: MouseEvent) => void;
    private documentMouseMoveListener?: (event: MouseEvent) => void;
    private documentMouseMoveCallback?: DocumentMouseMoveCallback;
    private autoScrollSelectionCallback?: AutoScrollSelectionCallback;

    constructor(gridDimensions: GridDimensions, cellComponents: Map<string, CellComponent<TExtraProps>>,
        headerComponents: Map<string, HeaderComponent>,
        pointerPositionCallback?: PointerPositionCallback,
        documentMouseMoveCallback?: DocumentMouseMoveCallback,
        autoScrollSelectionCallback?: AutoScrollSelectionCallback
    ) {
        this.gridDimensions = gridDimensions;
        this.cellComponents = cellComponents;
        this.headerComponents = headerComponents;
        this.navigationState = {
            pointerPosition: { row: 0, col: 0 },
            anchorPosition: { row: 0, col: 0 },
            navigationMode: false,
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

    getTableContainer(): HTMLDivElement | undefined {
        return this.tableContainer;
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

    // Process keyboard navigation analysis from InputAnalyzer
    processKeyboardNavigation(analysis: NavigationAnalysis): GridPosition {
        if (!this.isNavigationMode()) return this.getCurrentPosition();

        // Only process if we have a valid direction
        if (!analysis.direction) return this.getCurrentPosition();

        // ANCHOR COORDINATION: Set anchor before navigation if Shift is pressed and no anchor exists
        if (analysis.modifiers.shift && !this.getAnchor()) {
            this.setAnchor(this.getCurrentPosition());
        }

        const { row, col } = this.getCurrentPosition();
        const { maxRow, maxCol } = this.gridDimensions;
        let newPosition: GridPosition | null = null;

        // Handle Ctrl+Arrow for jumping to data boundaries (Excel-like behavior)
        if (analysis.modifiers.ctrl) {
            newPosition = this.findDataBoundary(row, col, analysis.direction);
        } else {
            // Normal single-step navigation
            switch (analysis.direction) {
                case 'up':
                    if (row > 0) {
                        newPosition = { row: row - 1, col };
                    }
                    break;
                case 'down':
                    if (row < maxRow) {
                        newPosition = { row: row + 1, col };
                    }
                    break;
                case 'left':
                    if (col > 0) {
                        newPosition = { row, col: col - 1 };
                    }
                    break;
                case 'right':
                    if (col < maxCol) {
                        newPosition = { row, col: col + 1 };
                    }
                    break;
            }
        }

        if (newPosition) {
            // Move pointer to new position
            this.movePointer(newPosition);

            // ANCHOR COORDINATION: Update anchor to follow pointer (except when Shift is pressed)
            if (!analysis.modifiers.shift) {
                this.setAnchor(newPosition);
            }
        }

        return this.navigationState.pointerPosition;
    }

    // TODO: Reimplement with new MouseEventAnalysis
    // Process mouse navigation and selection logic
    processMouseNavigation(analysis: MouseEventAnalysis) {
        const { type, position, navigationAction, componentType } = analysis;
        const context = this.getDraggingActionContext();

        // Switch case based on navigation action
        switch (navigationAction) {
            case 'start-cell-drag':
                // Cell drag: Normal behavior - set anchor and pointer to clicked cell
                if (this.isDragging()) {
                    // If dragging state is stuck it means the mouseup event was not registered
                    // ignore this current event
                    return;
                }
                const cellPosition = position as GridPosition;
                this.setAnchor(cellPosition);
                this.movePointer(cellPosition);
                this.setDragging(true);

                // Setup outside dragging listeners
                this.setupTableOutsideListeners();
                break;

            case 'start-row-drag':
                // Row drag: Set selection to entire row
                if (this.isDragging()) {
                    return;
                }
                const headerRowPos = position as HeaderPosition;
                const rowSelection = this.getRowSelectionRange(headerRowPos.index);
                // Pointer in the start, anchor in the end
                this.movePointer(rowSelection.start);
                this.setAnchor(rowSelection.end);
                this.setDragging(true);

                // Setup outside dragging listeners
                this.setupTableOutsideListeners();
                break;

            case 'start-col-drag':
                // Column drag: Set selection to entire column
                if (this.isDragging()) {
                    return;
                }
                const headerColPos = position as HeaderPosition;
                const colSelection = this.getColumnSelectionRange(headerColPos.index);
                this.movePointer(colSelection.start);
                this.setAnchor(colSelection.end);
                this.setDragging(true);

                // Setup outside dragging listeners
                this.setupTableOutsideListeners();
                break;

            case 'update-drag':
                // Shift+mousedown: Update pointer but keep anchor unchanged
                // For shift+drag, we need to handle based on original component type
                if (componentType === 'cell') {
                    this.movePointer(position as GridPosition);
                } else {
                    // Select rows/cols. Move pointer to start of the new row/col
                    // and anchor to the end of its actual row/col
                    if ((position as HeaderPosition).headerType === 'col') {
                        const colHeaderPos = position as HeaderPosition;
                        const colStart = this.getColumnSelectionRange(colHeaderPos.index);
                        this.movePointer(colStart.start);
                        const colEnd = this.getColumnSelectionRange(this.getAnchor().col);
                        this.setAnchor(colEnd.end);
                    } else {
                        const rowHeaderPos = position as HeaderPosition;
                        const rowStart = this.getRowSelectionRange(rowHeaderPos.index);
                        this.movePointer(rowStart.start);
                        const rowEnd = this.getRowSelectionRange(this.getAnchor().row);
                        this.setAnchor(rowEnd.end);
                    }
                }
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

                // Normal continue-drag processing (existing logic)
                if (componentType === 'cell') {
                    // If the drag was in cell context, just move the pointer
                    if (context.dragType === 'cell') {
                        this.movePointer(position as GridPosition);
                    } else if (context.dragType === 'row') {
                        // If the drag was in row context, move pointer to start of the cell's row
                        const cellPos = position as GridPosition;
                        const rowStart = this.getRowSelectionRange(cellPos.row);
                        this.movePointer(rowStart.start);
                    } else if (context.dragType === 'col') {
                        // If the drag was in col context, move pointer to start of the cell's column
                        const cellPos = position as GridPosition;
                        const colStart = this.getColumnSelectionRange(cellPos.col);
                        this.movePointer(colStart.start);
                    } else {
                        console.warn('Unknown drag type in continue-drag');
                        return;
                    }
                } else {
                    // If the drag was in cell context, just move the pointer
                    // position pointer in the first cell of row/col
                    if (context.dragType === 'cell') {
                        if ((position as HeaderPosition).headerType === 'col') {
                            const colHeaderPos = position as HeaderPosition;
                            const colStart = this.getColumnSelectionRange(colHeaderPos.index);
                            this.movePointer(colStart.start);
                        } else {
                            const rowHeaderPos = position as HeaderPosition;
                            const rowStart = this.getRowSelectionRange(rowHeaderPos.index);
                            this.movePointer(rowStart.start);
                        }
                    } else if (context.dragType === 'row') {
                        const rowHeaderPos = position as HeaderPosition;
                        const rowStart = this.getRowSelectionRange(rowHeaderPos.index);
                        this.movePointer(rowStart.start);
                    } else if (context.dragType === 'col') {
                        const colHeaderPos = position as HeaderPosition;
                        const colStart = this.getColumnSelectionRange(colHeaderPos.index);
                        this.movePointer(colStart.start);
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

        // Get cell element from components map (more efficient than DOM query)
        const key = `${position.row}-${position.col}`;
        const cellComponent = this.cellComponents.get(key);

        if (!cellComponent) return;

        const cellElement = cellComponent.element;
        const container = this.tableContainer;

        // Get header dimensions from actual header containers
        const headerHeight = this.columnsHeaderContainer?.clientHeight || 0;
        const headerWidth = this.rowsHeaderContainer?.clientWidth || 0;

        const containerRect = container.getBoundingClientRect();
        const cellRect = cellElement.getBoundingClientRect();

        // Calculate positions relative to container scroll
        const scrollTop = container.scrollTop;
        const scrollLeft = container.scrollLeft;

        // Adjust container dimensions to account for headers
        const effectiveContainerHeight = container.clientHeight - headerHeight;
        const effectiveContainerWidth = container.clientWidth - headerWidth;

        // Cell position relative to container
        const cellTop = cellRect.top - containerRect.top + scrollTop;
        const cellBottom = cellTop + cellRect.height;
        const cellLeft = cellRect.left - containerRect.left + scrollLeft;
        const cellRight = cellLeft + cellRect.width;

        // Calculate new vertical scroll (accounting for header height)
        let newScrollTop = scrollTop;
        if (cellTop < scrollTop + headerHeight) {
            // Cell is above visible area (behind column headers)
            newScrollTop = cellTop - headerHeight;
        } else if (cellBottom > scrollTop + headerHeight + effectiveContainerHeight) {
            // Cell is below visible area
            newScrollTop = cellBottom - headerHeight - effectiveContainerHeight;
        }

        // Calculate new horizontal scroll (accounting for header width)
        let newScrollLeft = scrollLeft;
        if (cellLeft < scrollLeft + headerWidth) {
            // Cell is to the left of visible area (behind row headers)
            newScrollLeft = cellLeft - headerWidth;
        } else if (cellRight > scrollLeft + headerWidth + effectiveContainerWidth) {
            // Cell is to the right of visible area
            newScrollLeft = cellRight - headerWidth - effectiveContainerWidth;
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

    setMousePosition(position: GridPosition): void {
        this.navigationState.mousePosition = { ...position };
    }

    getMousePosition(): GridPosition | undefined {
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

    // Navigation utility methods for programmatic movement

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
     */
    private executeAutoScroll(dimension: 'row' | 'col', direction: number): void {
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
                this.autoScrollSelectionCallback(newPosition);
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
}
