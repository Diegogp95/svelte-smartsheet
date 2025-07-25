export interface GridPosition {
    row: number;
    col: number;
}

export interface GridData {
    data: (string | number)[][];
    maxRow: number;
    maxCol: number;
}

export interface NavigationState {
    pointerPosition: GridPosition;
    navigationMode: boolean;
    selectedCells: Set<string>; // Set of strings "row-col" for efficient tracking
}

export class SmartSheetNavigation {
    private gridData: GridData;
    private navigationState: NavigationState;
    private tableContainer: HTMLDivElement | undefined;

    constructor(
        gridData: (string | number)[][],
        initialPosition: GridPosition = { row: 0, col: 0 }
    ) {
        this.gridData = {
            data: gridData,
            maxRow: gridData.length - 1,
            maxCol: (gridData[0]?.length || 1) - 1
        };
        
        this.navigationState = {
            pointerPosition: initialPosition,
            navigationMode: false,
            selectedCells: new Set<string>()
        };
    }

    // Update grid data
    updateGridData(newData: (string | number)[][]) {
        this.gridData = {
            data: newData,
            maxRow: newData.length - 1,
            maxCol: (newData[0]?.length || 1) - 1
        };
    }

    // Update container reference
    setTableContainer(container: HTMLDivElement) {
        this.tableContainer = container;
    }

    // Selection methods
    private positionToKey(position: GridPosition): string {
        return `${position.row}-${position.col}`;
    }

    private keyToPosition(key: string): GridPosition {
        const [row, col] = key.split('-').map(Number);
        return { row, col };
    }

    // Select a cell (deselects others)
    selectCell(position: GridPosition): NavigationState {
        // Create new Set to force reactivity
        this.navigationState.selectedCells = new Set([this.positionToKey(position)]);
        return { ...this.navigationState };
    }

    // Deselect all cells
    clearSelection(): NavigationState {
        // Create new empty Set to force reactivity
        this.navigationState.selectedCells = new Set<string>();
        return { ...this.navigationState };
    }

    // Check if a cell is selected
    isCellSelected(position: GridPosition): boolean {
        return this.navigationState.navigationMode && 
               this.navigationState.selectedCells.has(this.positionToKey(position));
    }

    // Get all selected cells
    getSelectedCells(): GridPosition[] {
        return Array.from(this.navigationState.selectedCells).map(key => this.keyToPosition(key));
    }

    // Activate navigation mode
    activateNavigation(): NavigationState {
        this.navigationState.navigationMode = true;
        // Select current cell when activating navigation
        this.selectCell(this.navigationState.pointerPosition);
        if (this.tableContainer) {
            this.tableContainer.focus();
        }
        return { ...this.navigationState };
    }

    // Deactivate navigation mode
    deactivateNavigation(): NavigationState {
        this.navigationState.navigationMode = false;
        // Clear selection when deactivating navigation
        this.clearSelection();
        return { ...this.navigationState };
    }

    // Handle keyboard events
    handleKeyDown(event: KeyboardEvent): NavigationState | null {
        if (!this.navigationState.navigationMode) return null;
        
        // Only process arrow keys
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
            return null;
        }
        
        // Prevent default arrow key behavior
        event.preventDefault();
        
        const { row, col } = this.navigationState.pointerPosition;
        const { maxRow, maxCol } = this.gridData;
        let newPosition: GridPosition | null = null;
        
        switch (event.key) {
            case 'ArrowUp':
                if (row > 0) {
                    newPosition = { row: row - 1, col };
                }
                break;
            case 'ArrowDown':
                if (row < maxRow) {
                    newPosition = { row: row + 1, col };
                }
                break;
            case 'ArrowLeft':
                if (col > 0) {
                    newPosition = { row, col: col - 1 };
                }
                break;
            case 'ArrowRight':
                if (col < maxCol) {
                    newPosition = { row, col: col + 1 };
                }
                break;
        }
        
        if (newPosition) {
            this.navigationState.pointerPosition = newPosition;
            // Select new cell (deselects previous)
            this.selectCell(newPosition);
            this.scrollToPosition(newPosition);
        }
        
        return { ...this.navigationState };
    }

    // Automatic scroll to keep pointer visible
    private scrollToPosition(position: GridPosition): void {
        if (!this.tableContainer) return;
        
        // Get cell element using data attributes
        const cellElement = this.tableContainer.querySelector(
            `[data-row="${position.row}"][data-col="${position.col}"]`
        ) as HTMLElement;
        
        if (!cellElement) return;
        
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

    // Get current state
    getState(): NavigationState {
        return { 
            ...this.navigationState,
            selectedCells: new Set(this.navigationState.selectedCells)
        };
    }

    // Get current cell information
    getCurrentCellValue(): string | number | undefined {
        const { row, col } = this.navigationState.pointerPosition;
        return this.gridData.data[row]?.[col];
    }

    // Move pointer to specific position
    moveToPosition(position: GridPosition): NavigationState | null {
        const { maxRow, maxCol } = this.gridData;
        
        if (position.row >= 0 && position.row <= maxRow && 
            position.col >= 0 && position.col <= maxCol) {
            this.navigationState.pointerPosition = { ...position };
            // If in navigation mode, select the new cell
            if (this.navigationState.navigationMode) {
                this.selectCell(position);
            }
            // Only scroll if container is available
            if (this.tableContainer) {
                this.scrollToPosition(position);
            }
            return { ...this.navigationState };
        }
        
        return null;
    }
}
