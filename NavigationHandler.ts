import type {
    GridPosition,
    GridDimensions,
    NavigationState,
    CellComponent,
    NavigationAnalysis,
    ClickAnalysis,
} from './types';

export type PointerPositionCallback = (handler: NavigationHandler) => void;

export default class NavigationHandler {
    private gridDimensions: GridDimensions;
    private navigationState: NavigationState;
    private tableContainer: HTMLDivElement | undefined;
    private cellComponents: Map<string, CellComponent>;
    private pointerPositionCallback?: PointerPositionCallback;

    constructor(gridDimensions: GridDimensions, cellComponents: Map<string, CellComponent>,
        pointerPositionCallback?: PointerPositionCallback
    ) {
        this.gridDimensions = gridDimensions;
        this.cellComponents = cellComponents;
        this.navigationState = {
            pointerPosition: { row: 0, col: 0 },
            anchorPosition: { row: 0, col: 0 },
            navigationMode: false,
            isDragging: false,
        };
        this.pointerPositionCallback = pointerPositionCallback;
    }

    // Update container reference
    setTableContainer(container: HTMLDivElement) {
        this.tableContainer = container;
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

    // Process mouse navigation and selection logic
    processMouseNavigation(analysis: ClickAnalysis): GridPosition {
        // Modifiers have priority over clickType
        const { type, position, modifiers, clickType } = analysis;

        // Shift modifier: update pointer but not anchor
        // ctrl modifier behaves just like normal event
        // shift + ctrl behaves like normal event
        if (modifiers.shift && !modifiers.ctrl ) {
            if (type === 'mousedown') {
                if (this.isDragging()) {
                    // Already dragging, probably from a previous mousedown followed by mouseup outside the grid
                    return this.getCurrentPosition();
                }
                this.movePointer(position);
                this.setDragging(true);
            } else if (type === 'mouseenter') {
                // Update pointer during drag
                if (!this.comparePositions(position, this.getMousePosition() || { row: -1, col: -1 })) {
                    this.setMousePosition(position);
                    if (this.isDragging()) {
                        this.movePointer(position);
                    }
                }
            } else if (type === 'mouseup') {
                // End selection by setting isDragging to false
                // need to move pointer?
                this.setDragging(false);
            }
        } else {
            if (type === 'mousedown') {
                if (this.isDragging()) {
                    // Already dragging, probably from a previous mousedown followed by mouseup outside the grid
                    return this.getCurrentPosition();
                }
                // Set anchor and pointer
                this.setAnchor(position);
                this.movePointer(position);
                this.setDragging(true);
            } else if (type === 'mouseenter') {
                // Update pointer during drag
                if (!this.comparePositions(position, this.getMousePosition() || { row: -1, col: -1 })) {
                    this.setMousePosition(position);
                    if (this.isDragging()) {
                        this.movePointer(position);
                    }
                }
            } else if (type === 'mouseup') {
                // End selection
                this.setDragging(false);
            }
        }
        return this.getCurrentPosition();
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
        const containerRect = container.getBoundingClientRect();
        const cellRect = cellElement.getBoundingClientRect();

        // Calculate positions relative to container scroll
        const scrollTop = container.scrollTop;
        const scrollLeft = container.scrollLeft;
        const containerHeight = container.clientHeight;
        const containerWidth = container.clientWidth;

        // Cell position relative to container
        const cellTop = cellRect.top - containerRect.top + scrollTop;
        const cellBottom = cellTop + cellRect.height;
        const cellLeft = cellRect.left - containerRect.left + scrollLeft;
        const cellRight = cellLeft + cellRect.width;

        // Calculate new vertical scroll
        let newScrollTop = scrollTop;
        if (cellTop < scrollTop) {
            // Cell is above visible area
            newScrollTop = cellTop;
        } else if (cellBottom > scrollTop + containerHeight) {
            // Cell is below visible area
            newScrollTop = cellBottom - containerHeight;
        }

        // Calculate new horizontal scroll
        let newScrollLeft = scrollLeft;
        if (cellLeft < scrollLeft) {
            // Cell is to the left of visible area
            newScrollLeft = cellLeft;
        } else if (cellRight > scrollLeft + containerWidth) {
            // Cell is to the right of visible area
            newScrollLeft = cellRight - containerWidth;
        }

        // Apply smooth scroll if there are changes
        if (newScrollTop !== scrollTop || newScrollLeft !== scrollLeft) {
            container.scrollTo({
                top: newScrollTop,
                left: newScrollLeft,
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

    getAnchor(): GridPosition | undefined {
        return this.navigationState.anchorPosition ? { ...this.navigationState.anchorPosition } : undefined;
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
        cellMatcher: (cell: CellComponent) => boolean
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
        cellMatcher: (cell: CellComponent) => boolean
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
}
