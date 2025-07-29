import type {
    GridPosition,
    GridDimensions,
    NavigationState,
    CellComponent,
    NavigationAnalysis,
    ClickAnalysis,
} from './types';

export default class NavigationHandler {
    private gridDimensions: GridDimensions;
    private navigationState: NavigationState;
    private tableContainer: HTMLDivElement | undefined;
    private cellComponents: Map<string, CellComponent>;

    constructor(gridDimensions: GridDimensions, cellComponents: Map<string, CellComponent>) {
        this.gridDimensions = gridDimensions;
        this.cellComponents = cellComponents;
        this.navigationState = {
            pointerPosition: { row: 0, col: 0 },
            navigationMode: false
        };
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
            this.navigationState.pointerPosition = { ...position };

            // Auto-scroll if container is available
            if (this.tableContainer) {
                this.scrollToPosition(position);
            }

            return { ...position };
        }

        return this.navigationState.pointerPosition; // Return current position if out of bounds
    }

    // Process keyboard navigation analysis from InputAnalyzer
    processKeyboardNavigation(analysis: NavigationAnalysis): GridPosition {
        if (!this.navigationState.navigationMode) return this.navigationState.pointerPosition;

        // Only process if we have a valid direction
        if (!analysis.direction) return this.navigationState.pointerPosition;

        // ANCHOR COORDINATION: Set anchor before navigation if Shift is pressed and no anchor exists
        if (analysis.modifiers.shift && !this.navigationState.anchorPosition) {
            this.setAnchor(this.navigationState.pointerPosition);
        }

        const { row, col } = this.navigationState.pointerPosition;
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
            this.navigationState.pointerPosition = newPosition;
            this.scrollToPosition(newPosition);

            // ANCHOR COORDINATION: Update anchor to follow pointer (except when Shift is pressed)
            if (!analysis.modifiers.shift) {
                this.setAnchor(newPosition);
            }
        }

        return this.navigationState.pointerPosition;
    }

    // Process mouse click navigation analysis from InputAnalyzer
    processMouseNavigation(analysis: ClickAnalysis): GridPosition {
        // Move pointer to clicked position
        const newPosition = this.movePointer(analysis.position);
        
        // ANCHOR COORDINATION: Handle anchor based on modifiers
        if (analysis.modifiers.shift && !analysis.modifiers.ctrl) {
            // SHIFT+CLICK: Keep anchor fixed (if exists) for rectangular selection
            if (!this.navigationState.anchorPosition) {
                // No anchor exists: set anchor at current position before click
                this.setAnchor(this.navigationState.pointerPosition);
            }
            // If anchor exists, keep it fixed for rectangular selection
        } else {
            // NORMAL/CTRL+CLICK: Update anchor to follow pointer (coordinated)
            this.setAnchor(newPosition);
        }

        return newPosition;
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
        // Clear anchor when deactivating navigation
        this.navigationState.anchorPosition = undefined;
        return false;
    }

    // Anchor management for rectangular selection
    setAnchor(position: GridPosition): void {
        this.navigationState.anchorPosition = { ...position };
        console.log(`Anchor set to: ${JSON.stringify(this.navigationState.anchorPosition)}`);
    }

    getAnchor(): GridPosition | undefined {
        return this.navigationState.anchorPosition ? { ...this.navigationState.anchorPosition } : undefined;
    }

    clearAnchor(): void {
        this.navigationState.anchorPosition = undefined;
        console.log('Anchor cleared');
    }

    // Getters
    getCurrentPosition(): GridPosition {
        return { ...this.navigationState.pointerPosition };
    }

    isNavigationMode(): boolean {
        return this.navigationState.navigationMode;
    }

    getNavigationState(): NavigationState {
        return { ...this.navigationState };
    }
}
